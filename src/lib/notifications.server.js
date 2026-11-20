function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

export async function deliverNotificationEmail(db, notificationId) {
  const result = await db.query(
    `select n.id,n.title,n.message,n.data,u.email,
       coalesce(pref.email_enabled,true) email_enabled
     from public.notifications n
     join neon_auth."user" u on u.id=n.user_id
     left join public.notification_preferences pref on pref.user_id=n.user_id
     where n.id=$1`,
    [notificationId],
  );
  if (!result.rowCount) return { sent: false, reason: "notification_not_found" };
  const item = result.rows[0];
  if (!item.email_enabled || !item.email) {
    await db.query(
      `insert into public.notification_deliveries(notification_id,channel,status,recipient,provider,error_message)
       values($1,'email','skipped',$2,'resend','E-mail désactivé ou adresse absente')
       on conflict(notification_id,channel) do update set status='skipped',updated_at=now()`,
      [notificationId, item.email || null],
    );
    return { sent: false, reason: "email_disabled" };
  }
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LAMA_MARKET_FROM_EMAIL;
  if (!apiKey || !from) {
    await db.query(
      `insert into public.notification_deliveries(notification_id,channel,status,recipient,provider,error_message)
       values($1,'email','skipped',$2,'resend','RESEND_API_KEY et LAMA_MARKET_FROM_EMAIL ne sont pas configurés')
       on conflict(notification_id,channel) do update set status='skipped',updated_at=now(),
       error_message=excluded.error_message`,
      [notificationId, item.email],
    );
    return { sent: false, reason: "email_provider_not_configured" };
  }

  await db.query(
    `insert into public.notification_deliveries(notification_id,channel,status,recipient,provider)
     values($1,'email','queued',$2,'resend')
     on conflict(notification_id,channel) do update set status='queued',recipient=excluded.recipient,
     provider='resend',error_message=null,updated_at=now()`,
    [notificationId, item.email],
  );

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [item.email],
        subject: item.title,
        text: item.message,
        html: `<main style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#18352a">
          <h2 style="color:#176b45">Lama Market</h2>
          <h3>${escapeHtml(item.title)}</h3>
          <p style="line-height:1.6">${escapeHtml(item.message)}</p>
          <p style="font-size:12px;color:#738278">Message automatique de Lama Market.</p>
        </main>`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || `Resend a répondu HTTP ${response.status}`);
    await db.query(
      "update public.notification_deliveries set status='sent',provider_reference=$2,sent_at=now(),error_message=null,updated_at=now() where notification_id=$1 and channel='email'",
      [notificationId, payload.id || null],
    );
    return { sent: true, id: payload.id || null };
  } catch (error) {
    const message = String(error?.message || "Échec de l'envoi").slice(0, 500);
    await db.query(
      "update public.notification_deliveries set status='failed',error_message=$2,updated_at=now() where notification_id=$1 and channel='email'",
      [notificationId, message],
    );
    return { sent: false, reason: message };
  }
}

export async function createNotification(db, { userId, type, title, message, data = {} }) {
  const result = await db.query(
    "insert into public.notifications(user_id,type,title,message,data) values($1,$2,$3,$4,$5) returning id",
    [userId, type, title, message, data],
  );
  const notificationId = result.rows[0].id;
  await deliverNotificationEmail(db, notificationId);
  return notificationId;
}
