import type { Entry } from "../match";

/** Hire requests, lead booking, the Classroom and the graphic maker. */
export const features: readonly Entry[] = [
  // ---- hire requests
  ["{0} wants to hire you for one call", "{0} quiere contratarte para una llamada", "{0} veut t'engager pour un appel", "{0} vuole ingaggiarti per una chiamata", "{0} möchte dich für einen Call buchen"],
  ["{0} wants to hire you for two calls", "{0} quiere contratarte para dos llamadas", "{0} veut t'engager pour deux appels", "{0} vuole ingaggiarti per due chiamate", "{0} möchte dich für zwei Calls buchen"],
  ["{0} wants to hire you for all their future calls", "{0} quiere contratarte para todas sus llamadas futuras", "{0} veut t'engager pour tous ses appels à venir", "{0} vuole ingaggiarti per tutte le sue chiamate future", "{0} möchte dich für alle seine zukünftigen Calls buchen"],
  ["Open Call Closers for Hire to accept or decline.", "Abre Cerradores a contratar para aceptar o rechazar.", "Ouvre Closers à engager pour accepter ou refuser.", "Apri Call closer su richiesta per accettare o rifiutare.", "Öffne Call-Closer zum Buchen, um anzunehmen oder abzulehnen."],
  ["{0} accepted your hire", "{0} aceptó tu contratación", "{0} a accepté ton engagement", "{0} ha accettato il tuo ingaggio", "{0} hat deine Buchung angenommen"],
  ["They will take the calls you asked for.", "Atenderá las llamadas que pediste.", "Il mènera les appels que tu as demandés.", "Farà le chiamate che hai richiesto.", "Er führt die Calls, die du angefragt hast."],
  ["{0} cannot take your calls right now", "{0} no puede atender tus llamadas ahora", "{0} ne peut pas mener tes appels pour le moment", "{0} non può fare le tue chiamate in questo momento", "{0} kann deine Calls gerade nicht übernehmen"],
  ["{0} has stopped taking your calls", "{0} dejó de atender tus llamadas", "{0} a arrêté de mener tes appels", "{0} ha smesso di fare le tue chiamate", "{0} führt deine Calls nicht mehr"],
  ["New calls go back to you. You can hire someone else any time.", "Las llamadas nuevas vuelven a ti. Puedes contratar a otra persona cuando quieras.", "Les nouveaux appels te reviennent. Tu peux engager quelqu'un d'autre à tout moment.", "Le nuove chiamate tornano a te. Puoi ingaggiare qualcun altro quando vuoi.", "Neue Calls gehen wieder an dich. Du kannst jederzeit jemand anderen buchen."],
  ["one call", "una llamada", "un appel", "una chiamata", "einen Call"],
  ["two calls", "dos llamadas", "deux appels", "due chiamate", "zwei Calls"],
  ["all their future calls", "todas sus llamadas futuras", "tous ses appels à venir", "tutte le sue chiamate future", "alle seine zukünftigen Calls"],
  ["Waiting for {0} to accept", "Esperando que {0} acepte", "En attente que {0} accepte", "In attesa che {0} accetti", "Warte darauf, dass {0} annimmt"],
  ["{0} has your request and will accept or decline it. You will get a notification.", "{0} tiene tu solicitud y la aceptará o rechazará. Recibirás una notificación.", "{0} a ta demande et va l'accepter ou la refuser. Tu recevras une notification.", "{0} ha la tua richiesta e la accetterà o rifiuterà. Riceverai una notifica.", "{0} hat deine Anfrage und nimmt sie an oder lehnt sie ab. Du bekommst eine Benachrichtigung."],
  ["Take back my request", "Retirar mi solicitud", "Retirer ma demande", "Ritira la mia richiesta", "Meine Anfrage zurückziehen"],
  ["Ask {0} to take my calls", "Pedir a {0} que atienda mis llamadas", "Demander à {0} de mener mes appels", "Chiedi a {0} di fare le mie chiamate", "{0} bitten, meine Calls zu führen"],
  ["Sending…", "Enviando…", "Envoi…", "Invio…", "Wird gesendet…"],
  ["Hire requests · {0}", "Solicitudes de contratación · {0}", "Demandes d'engagement · {0}", "Richieste di ingaggio · {0}", "Buchungsanfragen · {0}"],
  ["Wants to hire you for {0}.", "Quiere contratarte para {0}.", "Veut t'engager pour {0}.", "Vuole ingaggiarti per {0}.", "Möchte dich für {0} buchen."],
  ["Their note: {0}", "Su nota: {0}", "Sa note : {0}", "La sua nota: {0}", "Hinweis: {0}"],
  ["A note for them (optional)", "Una nota para esa persona (opcional)", "Une note pour cette personne (facultatif)", "Una nota per questa persona (facoltativo)", "Ein Hinweis für die Person (optional)"],
  ["A note for them", "Una nota para esa persona", "Une note pour cette personne", "Una nota per questa persona", "Ein Hinweis für die Person"],
  ["You are taking calls for", "Estás atendiendo llamadas de", "Tu mènes les appels de", "Stai facendo le chiamate di", "Du führst Calls für"],
  ["All their future calls", "Todas sus llamadas futuras", "Tous ses appels à venir", "Tutte le sue chiamate future", "Alle seine zukünftigen Calls"],
  ["{0} of {1} calls left", "{0} de {1} llamadas restantes", "{0} appels sur {1} restants", "{0} chiamate su {1} rimaste", "{0} von {1} Calls übrig"],
  ["Stop taking their calls", "Dejar de atender sus llamadas", "Arrêter de mener ses appels", "Smetti di fare le sue chiamate", "Ihre Calls nicht mehr führen"],
  ["We could not save that. The request may have been taken back.", "No pudimos guardar eso. Puede que la solicitud se haya retirado.", "On n'a pas pu enregistrer ça. La demande a peut-être été retirée.", "Non siamo riusciti a salvarlo. La richiesta potrebbe essere stata ritirata.", "Das konnte nicht gespeichert werden. Die Anfrage wurde vielleicht zurückgezogen."],
];
