// Regelkern von Packzettel: erzeugt aus Reiseart, Dauer, Wetter, Verkehrsmittel
// und Begleitung eine Packliste, ohne KI. Läuft im Browser (window.Pack) und in
// Node (require) für test.mjs.
(function (wurzel) {
  "use strict";

  var ARTEN = [["strand", "Strand"], ["stadt", "Städtereise"], ["berge", "Wandern"], ["winter", "Wintersport"], ["geschaeft", "Geschäftlich"], ["camping", "Camping"]];
  var WETTER = [["warm", "Warm"], ["gemischt", "Gemischt"], ["kalt", "Kalt"]];
  var VERKEHR = [["flug", "Flug"], ["auto", "Auto"], ["zug", "Bahn oder Bus"]];
  var EXTRAS = [["kind", "Mit Kind"], ["baby", "Mit Baby"], ["hund", "Mit Hund"], ["sport", "Sport"], ["schwimmen", "Schwimmen"], ["arbeit", "Laptop und Arbeit"]];
  var KATEGORIEN = ["Dokumente und Geld", "Kleidung", "Hygiene", "Technik", "Gesundheit", "Unterwegs", "Kind und Baby", "Hund", "Sport und Wasser", "Bevor du gehst"];
  var name = function (liste) { var o = {}; liste.forEach(function (x) { o[x[0]] = x[1]; }); return o; };
  var ART_NAME = name(ARTEN), WETTER_NAME = name(WETTER), VERKEHR_NAME = name(VERKEHR), EXTRA_NAME = name(EXTRAS);

  function eigen(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function ganz(v, min, max) {
    var n = typeof v === "number" ? v : parseInt(String(v == null ? "" : v).trim(), 10);
    return Number.isInteger(n) && n >= min && n <= max ? n : null;
  }
  function schluessel(text) {
    return String(text).toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  }
  // Schlüssel für eigene Gegenstände: lesbarer Teil plus kurzer Zahlen-Hash, damit
  // "Buch" und "Buch!" oder zwei Emoji-Namen nicht zusammenfallen.
  function eigenSchluessel(name) {
    var t = String(name).trim().toLowerCase(), h = 0;
    for (var i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0;
    return ("eigen-" + schluessel(t).slice(0, 30) + "-" + h.toString(36)).replace(/--+/g, "-");
  }

  // Bringt eine Reise aus Formular oder Sicherung in sichere Form; null, wenn unbrauchbar.
  function saeubern(r) {
    if (!r || typeof r !== "object") return null;
    var id = /^[a-z0-9]{6,40}$/.test(String(r.id || "")) ? String(r.id) : null;
    var reiseName = String(r.name || "").trim().slice(0, 60);
    if (!id || !reiseName || !eigen(ART_NAME, r.art)) return null;
    var extras = Array.isArray(r.extras) ? EXTRAS.map(function (e) { return e[0]; }).filter(function (e) { return r.extras.indexOf(e) >= 0; }) : [];
    function flags(o) {
      var t = {};
      if (o && typeof o === "object") Object.keys(o).forEach(function (k) { if (o[k] === true && /^[a-z0-9-]{1,60}$/.test(k)) t[k] = true; });
      return t;
    }
    var eigene = [];
    (Array.isArray(r.eigene) ? r.eigene : []).forEach(function (e) {
      if (!e || typeof e !== "object") return;
      var n = String(e.name || "").trim().slice(0, 60);
      if (!n) return;
      var kat = KATEGORIEN.indexOf(e.kat) >= 0 ? e.kat : "Unterwegs";
      var key = eigenSchluessel(n);
      // Gleicher Schlüssel: der letzte gewinnt.
      eigene = eigene.filter(function (x) { return x.key !== key; });
      eigene.push({ key: key, name: n, kat: kat });
    });
    eigene = eigene.slice(-200);
    return {
      id: id, t: Number.isFinite(r.t) && Math.abs(r.t) <= 8.64e15 ? r.t : 0, name: reiseName,
      art: r.art, tage: ganz(r.tage, 1, 90) || 7, wetter: eigen(WETTER_NAME, r.wetter) ? r.wetter : "gemischt",
      verkehr: eigen(VERKEHR_NAME, r.verkehr) ? r.verkehr : "flug", extras: extras,
      gepackt: flags(r.gepackt), entfernt: flags(r.entfernt), eigene: eigene
    };
  }

  // Die Regeln: jede Zeile ist [Kategorie, Name, Menge oder null, Bedingung].
  function vorschlaege(r) {
    var t = r.tage, kalt = r.wetter === "kalt", warm = r.wetter === "warm", gem = r.wetter === "gemischt";
    var hat = function (e) { return r.extras.indexOf(e) >= 0; };
    var lang = t > 7;
    var wasch = Math.min(t, 7);
    var L = [];
    function add(kat, n, menge, wenn) { if (wenn === undefined || wenn) L.push({ kat: kat, name: n, menge: menge || null }); }

    add("Dokumente und Geld", "Ausweis oder Reisepass");
    add("Dokumente und Geld", "Bankkarte und etwas Bargeld");
    add("Dokumente und Geld", "Buchungen und Tickets (auch offline)");
    add("Dokumente und Geld", "Krankenversicherungskarte");
    add("Dokumente und Geld", "Bordkarte oder Flugbestätigung", null, r.verkehr === "flug");
    add("Dokumente und Geld", "Führerschein und Fahrzeugpapiere", null, r.verkehr === "auto");
    add("Dokumente und Geld", "Bahn- oder Busticket", null, r.verkehr === "zug");
    add("Dokumente und Geld", "Auslandskrankenversicherung, falls vorhanden", null, t >= 3);

    add("Kleidung", "Unterwäsche", Math.min(t + 1, 8));
    add("Kleidung", "Socken", Math.min(t + 1, 8));
    add("Kleidung", "T-Shirts oder Oberteile", wasch);
    add("Kleidung", "Hosen oder Röcke", Math.min(Math.ceil(t / 3), 3));
    add("Kleidung", "Pullover oder Strickjacke", kalt ? 2 : 1, !warm || r.art === "berge");
    add("Kleidung", "Jacke", 1, gem && r.art !== "winter");
    add("Kleidung", "Warme Jacke, Mütze, Handschuhe, Schal", null, kalt || r.art === "winter");
    add("Kleidung", "Thermounterwäsche", null, r.art === "winter" || (kalt && r.art === "berge"));
    add("Kleidung", "Regenjacke", null, gem || r.art === "berge" || r.art === "camping");
    add("Kleidung", "Bequeme Schuhe", 1);
    add("Kleidung", "Wanderschuhe, eingelaufen", null, r.art === "berge");
    add("Kleidung", "Sandalen oder Badeschuhe", null, r.art === "strand" || warm);
    add("Kleidung", "Schlafanzug", 1);
    add("Kleidung", "Hemden oder Blusen", Math.min(t, 5), r.art === "geschaeft");
    add("Kleidung", "Anzug oder Business-Outfit", null, r.art === "geschaeft");
    add("Kleidung", "Skisocken", Math.min(t, 4), r.art === "winter");
    add("Kleidung", "Waschmittel für unterwegs", null, lang);

    add("Hygiene", "Zahnbürste und Zahnpasta");
    add("Hygiene", "Deo");
    add("Hygiene", "Duschgel und Shampoo");
    add("Hygiene", "Haarbürste oder Kamm");
    add("Hygiene", "Rasierer", null, true);
    add("Hygiene", "Sonnencreme", null, warm || r.art === "strand" || r.art === "winter" || r.art === "berge");
    add("Hygiene", "Lippenpflege", null, kalt || r.art === "winter" || r.art === "berge");
    add("Hygiene", "Flüssigkeiten im Handgepäck: Behälter bis 100 ml, zusammen in einem 1-Liter-Beutel", null, r.verkehr === "flug");

    add("Technik", "Handy und Ladekabel");
    add("Technik", "Powerbank");
    add("Technik", "Kopfhörer");
    add("Technik", "Reiseadapter, falls das Land andere Steckdosen hat", null, r.verkehr === "flug");
    add("Technik", "Laptop, Ladegerät und Maus", null, hat("arbeit") || r.art === "geschaeft");
    add("Technik", "Ladekabel fürs Auto", null, r.verkehr === "auto");

    add("Gesundheit", "Eigene Medikamente in ausreichender Menge");
    add("Gesundheit", "Pflaster und Schmerzmittel");
    add("Gesundheit", "Mückenschutz", null, warm || r.art === "camping" || r.art === "berge");
    add("Gesundheit", "Blasenpflaster", null, r.art === "berge" || r.art === "stadt");

    add("Unterwegs", "Trinkflasche");
    add("Unterwegs", "Snacks für die Reise");
    add("Unterwegs", "Nackenkissen", null, r.verkehr !== "auto" && t >= 2);
    add("Unterwegs", "Tagesrucksack");
    add("Unterwegs", "Sonnenbrille", null, warm || r.art === "strand" || r.art === "winter");
    add("Unterwegs", "Strandtuch", null, r.art === "strand");
    add("Unterwegs", "Warnweste, Warndreieck, Verbandskasten im Auto prüfen", null, r.verkehr === "auto");
    add("Unterwegs", "Zelt, Isomatte, Schlafsack", null, r.art === "camping");
    add("Unterwegs", "Stirnlampe", null, r.art === "camping" || r.art === "berge");
    add("Unterwegs", "Skipass", null, r.art === "winter");

    add("Kind und Baby", "Windeln", Math.min(t * 6, 60), hat("baby"));
    add("Kind und Baby", "Feuchttücher und Wickelunterlage", null, hat("baby"));
    add("Kind und Baby", "Fläschchen, Nahrung, Schnuller", null, hat("baby"));
    add("Kind und Baby", "Kinderwagen oder Trage", null, hat("baby"));
    add("Kind und Baby", "Lieblingskuscheltier", null, hat("baby") || hat("kind"));
    add("Kind und Baby", "Beschäftigung für die Fahrt (Bücher, Malzeug)", null, hat("kind"));
    add("Kind und Baby", "Wechselkleidung extra", null, hat("kind") || hat("baby"));
    add("Kind und Baby", "Kindersitz oder Sitzerhöhung", null, (hat("kind") || hat("baby")) && r.verkehr === "auto");

    add("Hund", "Futter und Napf", null, hat("hund"));
    add("Hund", "Leine, Halsband mit Adresse, Kotbeutel", null, hat("hund"));
    add("Hund", "Heimtierausweis und Impfnachweis", null, hat("hund"));
    add("Hund", "Decke oder Körbchen", null, hat("hund"));

    add("Sport und Wasser", "Badesachen", Math.min(Math.ceil(t / 3), 3), r.art === "strand" || hat("schwimmen"));
    add("Sport und Wasser", "Sportkleidung und Sportschuhe", null, hat("sport"));
    add("Sport und Wasser", "Schwimmbrille oder Schnorchel", null, hat("schwimmen"));
    add("Sport und Wasser", "Skiausrüstung oder Verleih klären", null, r.art === "winter");

    add("Bevor du gehst", "Herd, Bügeleisen und Lichter aus");
    add("Bevor du gehst", "Fenster zu, Heizung runter");
    add("Bevor du gehst", "Müll raus, Kühlschrank leeren", null, t >= 3);
    add("Bevor du gehst", "Pflanzen gießen oder Nachbarn bitten", null, t >= 5);
    add("Bevor du gehst", "Schlüssel und Ladekabel griffbereit");

    return L.map(function (x) { return { key: schluessel(x.kat) + "-" + schluessel(x.name), kat: x.kat, name: x.name, menge: x.menge }; });
  }

  // Fertige Liste je Kategorie: Vorschläge minus entfernte plus eigene, mit Häkchen.
  function liste(r) {
    var alle = vorschlaege(r).filter(function (x) { return !r.entfernt[x.key]; });
    r.eigene.forEach(function (e) { if (!r.entfernt[e.key]) alle.push({ key: e.key, kat: e.kat, name: e.name, menge: null, eigen: true }); });
    return KATEGORIEN.map(function (kat) {
      var items = alle.filter(function (x) { return x.kat === kat; }).map(function (x) { return Object.assign({ gepackt: r.gepackt[x.key] === true }, x); });
      return { kat: kat, items: items };
    }).filter(function (g) { return g.items.length; });
  }

  function fortschritt(r) {
    var n = 0, g = 0;
    liste(r).forEach(function (k) { k.items.forEach(function (x) { n++; if (x.gepackt) g++; }); });
    return { gesamt: n, gepackt: g };
  }

  // Text zum Teilen: offene Punkte je Kategorie.
  function text(r, nurOffen) {
    var z = [r.name + " (" + r.tage + " Tage, " + ART_NAME[r.art] + ")"];
    liste(r).forEach(function (k) {
      var items = k.items.filter(function (x) { return !nurOffen || !x.gepackt; });
      if (!items.length) return;
      z.push("", k.kat + ":");
      items.forEach(function (x) { z.push((x.gepackt ? "[x] " : "[ ] ") + x.name + (x.menge ? " (" + x.menge + ")" : "")); });
    });
    return z.join("\n");
  }

  function sicherung(reisen, merken) { return JSON.stringify({ app: "packzettel", v: 1, reisen: reisen, merken: merken }, null, 1); }
  function sicherungLesen(t) {
    var d;
    try { d = JSON.parse(String(t || "")); } catch (e) { return null; }
    if (!d || d.app !== "packzettel" || !Array.isArray(d.reisen)) return null;
    var gut = [], kaputt = 0;
    d.reisen.forEach(function (x) { var s = saeubern(x); if (s) gut.push(s); else kaputt++; });
    var merken = Array.isArray(d.merken) ? d.merken.map(function (m) {
      if (!m || typeof m !== "object") return null;
      var n = String(m.name || "").trim().slice(0, 60);
      return n ? { name: n, kat: KATEGORIEN.indexOf(m.kat) >= 0 ? m.kat : "Unterwegs" } : null;
    }).filter(Boolean).slice(0, 200) : [];
    return { reisen: gut, merken: merken, kaputt: kaputt };
  }
  function zusammenfuehren(alt, neu) {
    var nachId = {}, dazu = 0, aktualisiert = 0;
    alt.forEach(function (r) { nachId[r.id] = r; });
    neu.forEach(function (r) {
      if (!Object.prototype.hasOwnProperty.call(nachId, r.id)) { nachId[r.id] = r; dazu++; }
      else if (r.t > nachId[r.id].t) { nachId[r.id] = r; aktualisiert++; }
    });
    return { liste: Object.keys(nachId).map(function (k) { return nachId[k]; }), dazu: dazu, aktualisiert: aktualisiert };
  }

  var api = { eigenSchluessel: eigenSchluessel, ARTEN: ARTEN, WETTER: WETTER, VERKEHR: VERKEHR, EXTRAS: EXTRAS, KATEGORIEN: KATEGORIEN, ART_NAME: ART_NAME,
    WETTER_NAME: WETTER_NAME, VERKEHR_NAME: VERKEHR_NAME, EXTRA_NAME: EXTRA_NAME, schluessel: schluessel, saeubern: saeubern,
    vorschlaege: vorschlaege, liste: liste, fortschritt: fortschritt, text: text, sicherung: sicherung,
    sicherungLesen: sicherungLesen, zusammenfuehren: zusammenfuehren };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else wurzel.Pack = api;
})(this);
