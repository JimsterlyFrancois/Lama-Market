export const STATUS = {
  pending: { label: "En attente", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  validated: { label: "Validée", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  completed: { label: "Terminée", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  cancelled: { label: "Annulée", cls: "bg-muted text-muted-foreground" },
};

export const CATEGORY_OPTIONS = [
  ["epicerie", "Épicerie"],
  ["maison", "Maison"],
  ["beaute", "Beauté"],
  ["electronique", "Électronique"],
  ["mode", "Mode"],
  ["bons-plans", "Bons plans"],
];