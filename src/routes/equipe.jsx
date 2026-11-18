import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getAccessToken } from "../lib/auth-client";
import {
  getStaffWorkspace, adminListStaff, adminAddStaff, adminUpdateStaff,
  staffUpdateOrderStatus, staffAdjustStock,
} from "../lib/commerce";

export const Route = createFileRoute("/equipe")({ component: StaffPage });

const roleLabels = {
  admin: "Administration",
  manager: "Responsable de boutique",
  cashier: "Caisse et commandes",
  inventory: "Stock et inventaire",
  fulfillment: "Préparation des commandes",
};
const statusLabels = {
  confirmed: "Confirmée",
  preparing: "En préparation",
  ready_for_delivery: "Prête pour livraison",
  assigned: "Livreur affecté",
  in_transit: "En livraison",
  delivered: "Livrée",
  cash_due: "À encaisser",
  cash_collected: "Encaissé",
  paid: "Payé",
  pending: "En attente",
};

function StaffPage() {
  const [workspace, setWorkspace] = useState(null);
  const [team, setTeam] = useState([]);
  const [notice, setNotice] = useState("Chargement de votre espace...");
  const [busy, setBusy] = useState(false);
  const [employee, setEmployee] = useState({ email: "", displayName: "", phone: "", staffRole: "cashier" });

  async function load() {
    try {
      const token = await getAccessToken();
      const data = await getStaffWorkspace({ data: { token } });
      setWorkspace(data);
      if (data.staffRole === "admin") setTeam(await adminListStaff({ data: { token } }));
      setNotice("");
    } catch (error) {
      setNotice(error.message || "Impossible de charger cet espace.");
    }
  }
  useEffect(() => { load(); }, []);

  async function act(fn, payload) {
    setBusy(true);
    setNotice("");
    try {
      const token = await getAccessToken();
      await fn({ data: { token, ...payload } });
      await load();
      setNotice("Mise à jour enregistrée.");
    } catch (error) {
      setNotice(error.message || "Opération impossible.");
    } finally { setBusy(false); }
  }

  async function addEmployee(event) {
    event.preventDefault();
    await act(adminAddStaff, employee);
    setEmployee({ email: "", displayName: "", phone: "", staffRole: "cashier" });
  }

  const role = workspace?.staffRole;
  const canHandleOrders = ["admin", "manager", "cashier", "fulfillment"].includes(role);
  const canHandleStock = ["admin", "manager", "inventory"].includes(role);

  return (
    <main className="commerce-page staff-page">
      <header className="commerce-header">
        <Link to="/">← Boutique</Link>
        <strong>Équipe Lama Market</strong>
        <Link to="/compte">Mon compte</Link>
      </header>
      <div className="commerce-container">
        <div className="commerce-title">
          <span>ESPACE DE TRAVAIL</span>
          <h1>Bonjour{workspace?.profile?.display_name ? ", " + workspace.profile.display_name : ""}</h1>
          <p>{roleLabels[role] || "Espace réservé au personnel"} · Les tâches affichées dépendent de vos autorisations.</p>
        </div>
        {notice && <div className="form-message admin-notice" role="status">{notice}</div>}
        {workspace && <>
          <div className="admin-stat-grid">
            <Stat label="Commandes à traiter" value={workspace.orders.filter(o => ["confirmed","preparing","ready_for_delivery"].includes(o.status)).length} />
            <Stat label="Produits suivis" value={workspace.products.length} />
            <Stat label="Alertes de stock" value={workspace.products.filter(p => p.is_active && p.stock <= p.low_stock_threshold).length} />
            <Stat label="Paiements récents" value={workspace.payments.length} />
          </div>

          {canHandleOrders && <section className="commerce-panel staff-section">
            <div className="staff-section-heading"><div><span className="section-kicker">SERVICE CLIENT</span><h2>Commandes à traiter</h2></div><span className="staff-count">{workspace.orders.length}</span></div>
            <div className="staff-order-list">
              {workspace.orders.map(order => <article className="staff-order" key={order.id}>
                <div className="staff-order-top"><strong>{order.order_number}</strong><span>{new Date(order.created_at).toLocaleString("fr-FR")}</span></div>
                <div className="staff-order-details">
                  <span>Commande : <b>{statusLabels[order.status] || order.status}</b></span>
                  <span>Paiement : <b>{statusLabels[order.payment_status] || order.payment_status}</b></span>
                  <span>Livraison : <b>{statusLabels[order.delivery_status] || order.delivery_status}</b></span>
                </div>
                <p>{order.items.map(item => item.quantity + " × " + item.name).join(" · ")}</p>
                <div className="staff-order-bottom"><strong>{Number(order.total).toLocaleString("fr-HT")} HTG</strong>
                  {order.status === "confirmed" && <button className="account-submit staff-action" disabled={busy} onClick={() => act(staffUpdateOrderStatus, { orderId: order.id, status: "preparing" })}>Commencer la préparation</button>}
                  {order.status === "preparing" && <button className="account-submit staff-action" disabled={busy} onClick={() => act(staffUpdateOrderStatus, { orderId: order.id, status: "ready_for_delivery" })}>Marquer prête</button>}
                  {order.status === "ready_for_delivery" && <span className="staff-done">En attente du livreur</span>}
                </div>
              </article>)}
              {!workspace.orders.length && <p className="muted-note">Aucune commande active.</p>}
            </div>
          </section>}

          {canHandleStock && <section className="commerce-panel staff-section">
            <div className="staff-section-heading"><div><span className="section-kicker">INVENTAIRE</span><h2>Suivi des produits</h2></div><span className="staff-count">{workspace.products.length}</span></div>
            <div className="staff-stock-list">
              {workspace.products.map(product => <div className="staff-stock-row" key={product.id}>
                <div className="staff-stock-info"><strong>{product.name}</strong><small>{product.sku || "Sans référence"}</small></div>
                <span className={product.stock <= product.low_stock_threshold ? "staff-stock-low" : "staff-stock-ok"}>{product.stock} en stock</span>
                <button className="text-button" disabled={busy} onClick={() => { const value = window.prompt("Variation du stock (ex. 8 pour ajouter, -2 pour retirer)"); if (value !== null && value.trim() && Number.isInteger(Number(value)) && Number(value) !== 0) act(staffAdjustStock, { productId: product.id, delta: Number(value), note: "Mouvement saisi depuis l'espace équipe" }); }}>Ajuster</button>
              </div>)}
            </div>
          </section>}

          <section className="commerce-panel staff-section">
            <div className="staff-section-heading"><div><span className="section-kicker">SUIVI FINANCIER</span><h2>Derniers paiements</h2></div></div>
            <div className="staff-payment-list">
              {workspace.payments.map(payment => <div className="staff-payment-row" key={payment.id}>
                <div><strong>{payment.order_number}</strong><small>{payment.method === "cash_on_delivery" ? "Paiement à la livraison" : payment.method}</small></div>
                <strong>{Number(payment.amount).toLocaleString("fr-HT")} HTG</strong>
                <span>{statusLabels[payment.status] || payment.status}</span>
              </div>)}
              {!workspace.payments.length && <p className="muted-note">Aucun paiement enregistré.</p>}
            </div>
            <p className="muted-note">Les paiements mobiles ne sont pas encore activés. Un statut « payé » n'est affiché qu'après confirmation enregistrée côté serveur.</p>
          </section>

          {role === "admin" && <section className="commerce-panel staff-section">
            <div className="staff-section-heading"><div><span className="section-kicker">GESTION DU PERSONNEL</span><h2>Les membres de l'équipe</h2></div><span className="staff-count">{team.length}</span></div>
            <p className="muted-note">Chaque employé doit d'abord créer son compte Lama Market. Vous pouvez ensuite lui attribuer une fonction. Les accès sont individuels et révocables.</p>
            <form className="account-form staff-add-form" onSubmit={addEmployee}>
              <label>E-mail du compte<input type="email" required value={employee.email} onChange={e => setEmployee({ ...employee, email: e.target.value })} /></label>
              <label>Nom affiché<input required value={employee.displayName} onChange={e => setEmployee({ ...employee, displayName: e.target.value })} /></label>
              <label>Téléphone<input value={employee.phone} onChange={e => setEmployee({ ...employee, phone: e.target.value })} /></label>
              <label>Responsabilité<select value={employee.staffRole} onChange={e => setEmployee({ ...employee, staffRole: e.target.value })}><option value="cashier">Caisse et commandes</option><option value="inventory">Stock et inventaire</option><option value="fulfillment">Préparation des commandes</option><option value="manager">Responsable de boutique</option></select></label>
              <button className="account-submit" disabled={busy}>Ajouter à l'équipe</button>
            </form>
            <div className="staff-team-list">{team.map(member => <div className="staff-team-row" key={member.user_id}>
              <div><strong>{member.display_name}</strong><small>{member.email} · {member.phone || "Téléphone non renseigné"}</small></div>
              <select value={member.staff_role} disabled={busy} onChange={e => act(adminUpdateStaff, { userId: member.user_id, staffRole: e.target.value, isActive: member.is_active })}><option value="cashier">Caisse</option><option value="inventory">Stock</option><option value="fulfillment">Préparation</option><option value="manager">Responsable</option></select>
              <button className="text-button" disabled={busy} onClick={() => act(adminUpdateStaff, { userId: member.user_id, staffRole: member.staff_role, isActive: !member.is_active })}>{member.is_active ? "Désactiver" : "Réactiver"}</button>
            </div>)}</div>
          </section>}
        </>}
      </div>
    </main>
  );
}

function Stat({ label, value }) {
  return <div className="admin-stat"><small>{label}</small><strong>{value}</strong></div>;
}
