// Prüft den Regelkern: node test.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const P = createRequire(import.meta.url)("./pack.js");

const basis = { id: "reise01", t: 1, name: "Kreta", art: "strand", tage: 7, wetter: "warm", verkehr: "flug", extras: [], gepackt: {}, entfernt: {}, eigene: [] };
assert.deepEqual(P.saeubern(basis), basis);
assert.equal(P.saeubern({ ...basis, name: "" }), null);
assert.equal(P.saeubern({ ...basis, art: "mond" }), null);
assert.equal(P.saeubern({ ...basis, id: "<x>" }), null);
assert.equal(P.saeubern({ ...basis, tage: 500 }).tage, 7);
assert.equal(P.saeubern({ ...basis, wetter: "nass" }).wetter, "gemischt");
assert.deepEqual(P.saeubern({ ...basis, extras: ["hund", "quatsch", "kind"] }).extras, ["kind", "hund"]);
assert.deepEqual(P.saeubern({ ...basis, gepackt: { "__proto__": true, "ok-1": true, "böse key": true } }).gepackt, { "ok-1": true });
assert.equal(P.saeubern({ ...basis, t: 1e17 }).t, 0);
const ek = P.eigenSchluessel("Kindle");
assert.ok(/^eigen-kindle-[a-z0-9]+$/.test(ek));
assert.deepEqual(P.saeubern({ ...basis, eigene: [{ name: "Kindle", kat: "Technik" }, { name: "", kat: "x" }] }).eigene, [{ key: ek, name: "Kindle", kat: "Technik" }]);
// Eingebaute Objektnamen kommen nicht durch (sonst Absturz beim Laden).
assert.equal(P.saeubern({ ...basis, art: "toString" }), null);
assert.equal(P.saeubern({ ...basis, art: "__proto__" }), null);
assert.equal(P.saeubern({ ...basis, wetter: "constructor" }).wetter, "gemischt");
assert.equal(P.saeubern({ ...basis, verkehr: "hasOwnProperty" }).verkehr, "flug");
// Eigene Gegenstände: verschiedene Namen bekommen verschiedene Schlüssel, gleiche fallen zusammen.
assert.notEqual(P.eigenSchluessel("Buch"), P.eigenSchluessel("Buch!"));
assert.notEqual(P.eigenSchluessel("🎧"), P.eigenSchluessel("🧴"));
assert.equal(P.eigenSchluessel("Buch"), P.eigenSchluessel(" Buch "));
assert.equal(P.eigenSchluessel("Buch"), P.eigenSchluessel("buch"));
assert.ok(/^[a-z0-9-]{1,60}$/.test(P.eigenSchluessel("🎧")));
const doppelt = P.saeubern({ ...basis, eigene: [{ name: "Buch", kat: "Technik" }, { name: "Buch!", kat: "Technik" }, { name: "Buch", kat: "Unterwegs" }] }).eigene;
assert.equal(doppelt.length, 2);
assert.equal(doppelt.find((e) => e.name === "Buch").kat, "Unterwegs");

// Mengen skalieren mit der Dauer, gedeckelt bei Wäsche
const v7 = P.vorschlaege(basis);
const finde = (l, n) => l.find((x) => x.name === n);
assert.equal(finde(v7, "Unterwäsche").menge, 8);
assert.equal(finde(v7, "T-Shirts oder Oberteile").menge, 7);
assert.equal(finde(v7, "Hosen oder Röcke").menge, 3);
const v2 = P.vorschlaege({ ...basis, tage: 2 });
assert.equal(finde(v2, "Unterwäsche").menge, 3);
assert.equal(finde(v2, "T-Shirts oder Oberteile").menge, 2);
assert.equal(finde(v2, "Hosen oder Röcke").menge, 1);
assert.equal(finde(v2, "Pflanzen gießen oder Nachbarn bitten"), undefined);
assert.ok(finde(P.vorschlaege({ ...basis, tage: 14 }), "Waschmittel für unterwegs"));

// Bedingungen
assert.ok(finde(v7, "Flüssigkeiten im Handgepäck: Behälter bis 100 ml, zusammen in einem 1-Liter-Beutel"));
assert.ok(finde(v7, "Badesachen"));
assert.equal(finde(v7, "Jacke"), undefined);
assert.ok(finde(P.vorschlaege({ ...basis, wetter: "gemischt" }), "Jacke"));
const winter = P.vorschlaege({ ...basis, art: "winter", wetter: "kalt" });
assert.equal(winter.filter((x) => /unterwäsche/i.test(x.name)).length, 2); // Unterwäsche und Thermounterwäsche
assert.equal(winter.filter((x) => /verleih/i.test(x.name)).length, 1);
const auto = P.vorschlaege({ ...basis, art: "berge", wetter: "kalt", verkehr: "auto" });
assert.equal(finde(auto, "Flüssigkeiten im Handgepäck: Behälter bis 100 ml, zusammen in einem 1-Liter-Beutel"), undefined);
assert.ok(finde(auto, "Führerschein und Fahrzeugpapiere"));
assert.ok(finde(auto, "Wanderschuhe, eingelaufen"));
assert.ok(finde(auto, "Warme Jacke, Mütze, Handschuhe, Schal"));
assert.equal(finde(auto, "Windeln"), undefined);
assert.equal(finde(auto, "Jacke"), undefined); // kalt: nur die warme Jacke
const baby = P.vorschlaege({ ...basis, extras: ["baby"], tage: 3 });
assert.equal(finde(baby, "Windeln").menge, 18);
assert.ok(finde(P.vorschlaege({ ...basis, extras: ["hund"] }), "Heimtierausweis und Impfnachweis"));
assert.ok(finde(P.vorschlaege({ ...basis, art: "geschaeft" }), "Anzug oder Business-Outfit"));
// Schlüssel eindeutig
const keys = v7.map((x) => x.key);
assert.equal(new Set(keys).size, keys.length);

// Liste: entfernte weg, eigene dazu, Häkchen und Fortschritt
const r = { ...basis, entfernt: { [finde(v7, "Deo").key]: true }, eigene: [{ key: ek, name: "Kindle", kat: "Technik" }], gepackt: { [ek]: true } };
const l = P.liste(r);
assert.equal(l.find((k) => k.kat === "Hygiene").items.some((x) => x.name === "Deo"), false);
const technik = l.find((k) => k.kat === "Technik").items;
assert.ok(technik.some((x) => x.name === "Kindle" && x.gepackt && x.eigen));
const f = P.fortschritt(r);
assert.equal(f.gepackt, 1);
assert.equal(f.gesamt, v7.length - 1 + 1);
assert.equal(P.liste({ ...basis }).some((k) => k.kat === "Hund"), false);

// Text zum Teilen
const tx = P.text(r, true);
assert.ok(tx.startsWith("Kreta (7 Tage, Strand)"));
assert.ok(tx.includes("[ ] Unterwäsche (8)"));
assert.ok(!tx.includes("Kindle")); // gepackt und nurOffen
assert.ok(P.text(r, false).includes("[x] Kindle"));

// Sicherung und Zusammenführen
const s = P.sicherungLesen(P.sicherung([r], [{ name: "Kindle", kat: "Technik" }]));
assert.equal(s.kaputt, 0);
assert.deepEqual(s.reisen, [P.saeubern(r)]);
assert.deepEqual(s.merken, [{ name: "Kindle", kat: "Technik" }]);
assert.equal(P.sicherungLesen("{}"), null);
const m = P.zusammenfuehren([basis], [{ ...basis, t: 5, name: "Kreta 2027" }, { ...basis, id: "reise02" }]);
assert.equal(m.dazu, 1);
assert.equal(m.aktualisiert, 1);
assert.equal(m.liste.find((x) => x.id === "reise01").name, "Kreta 2027");

console.log("pack.js: alle Prüfungen bestanden");
