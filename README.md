# Gestion Locative

Application interne de gestion d'un patrimoine immobilier locatif : biens,
locataires, contrats, loyers automatiques, paiements, dépenses, rentabilité,
rapports et documents.

**Stack** — Next.js 16 (App Router, Server Actions) · TypeScript · Tailwind CSS 4 ·
Supabase (PostgreSQL + Auth + Storage) · Recharts · jsPDF.

---

## 1. Principe

Toute la logique financière vit **dans la base de données**, pas dans l'interface :

| Calcul | Où il vit |
|---|---|
| Investissement total = achat + frais + travaux | colonne générée `properties.total_investment` |
| Génération des loyers mensuels | fonction `generate_rents()`, idempotente |
| Total payé d'un loyer | trigger sur `payments` → `rents.amount_paid` |
| Reste à payer et statut (À payer / Payé / Partiel / Impayé) | vue `v_rents`, recalculée à chaque lecture |
| Statut du bien (Libre / Loué) | trigger sur `contracts` |
| Rentabilité par bien et globale | vues `v_property_stats`, `v_dashboard` |
| Alertes (impayés, échéances, contrats, assurances) | vue `v_notifications` |
| Historique des modifications | triggers `audit_log` sur 5 tables |

Conséquence : aucun chiffre n'est saisi deux fois, et rien ne se désynchronise —
le statut « Impayé » apparaît de lui-même dès que l'échéance est dépassée, sans
tâche planifiée.

---

## 2. Installation de la base de données

À faire **une seule fois**, avant le premier lancement.

1. Ouvrir l'éditeur SQL du projet Supabase :
   `https://supabase.com/dashboard/project/<votre-projet>/sql/new`
2. Copier **tout** le contenu de `supabase/schema_complet.sql` et le coller.
3. Cliquer sur **Run**.

Le script est idempotent : le relancer ne casse rien.

Il crée les tables `profiles`, `properties`, `tenants`, `contracts`, `rents`,
`payments`, `expenses`, `documents`, `notification_dismissals`, `audit_log`,
les triggers, les vues, les politiques de sécurité (RLS) et le bucket privé
`documents`.

### Créer le compte propriétaire

Dans Supabase : **Authentication → Users → Add user**, saisir l'email et le mot
de passe, cocher **Auto Confirm User**. Le profil (`profiles`) est créé
automatiquement au premier login, avec le rôle `proprietaire`.

---

## 3. Lancer en local

```bash
npm install
cp .env.example .env.local   # puis renseigner les clés
npm run dev                  # http://localhost:3000
```

Variables d'environnement (Supabase → **Project Settings → API Keys**) :

```
NEXT_PUBLIC_SUPABASE_URL=https://<projet>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_…
```

La clé publiable est conçue pour être exposée au navigateur : la sécurité repose
sur les politiques RLS, pas sur le secret de la clé.

---

## 4. Déploiement sur Vercel

1. Pousser le dépôt sur GitHub.
2. Sur Vercel : **Add New → Project**, importer le dépôt.
3. Renseigner les deux variables d'environnement ci-dessus
   (Production, Preview et Development).
4. **Deploy**. Aucune configuration de build n'est nécessaire.

`vercel.json` fixe la région d'exécution à **fra1** (Francfort), celle du projet
Supabase. Chaque page fait plusieurs allers-retours vers la base : exécuter le
serveur à côté d'elle évite de traverser l'Atlantique à chaque requête.

Ensuite, dans Supabase → **Authentication → URL Configuration**, ajouter l'URL
Vercel dans *Site URL* et *Redirect URLs*.

---

## 5. Rôles et permissions

| Rôle | Lecture | Écriture |
|---|---|---|
| `proprietaire` | oui | oui |
| `gestionnaire` | oui | oui |
| `lecteur` | oui | non |

Le rôle se change dans la table `profiles`. Les politiques RLS et l'interface
respectent tous deux ce réglage : un `lecteur` ne voit aucun bouton d'action et
ses écritures sont refusées par la base.

---

## 6. Sauvegarde

**Paramètres → Sauvegarde et restauration** exporte l'intégralité des données
métier dans un fichier JSON, et permet de le réinjecter.

La restauration procède par **fusion** : chaque enregistrement est réinséré ou
mis à jour sur son identifiant, rien n'est supprimé. Les fichiers joints restent
dans Supabase Storage — le JSON ne contient que leurs références.

Supabase assure par ailleurs ses propres sauvegardes automatiques de la base.

---

## 7. Organisation du code

```
supabase/migrations/     0001 tables · 0002 triggers · 0003 vues · 0004 sécurité
supabase/schema_complet.sql   les 4 migrations concaténées, à coller dans Supabase

src/app/(app)/           pages authentifiées (dashboard, biens, loyers, rapports…)
src/app/login/           page de connexion
src/components/ui/       kit d'interface (champs, badges, modale, filtres)
src/components/charts/   graphiques Recharts + jetons de couleur validés
src/lib/actions/         Server Actions (une par domaine métier)
src/lib/data/            chargeurs de données partagés
src/lib/pdf.ts           reçus et rapports PDF
src/lib/format.ts        formatage français, dinar tunisien, libellés
src/proxy.ts             garde de session sur toutes les routes
```

## 8. Accessibilité

L'application est utilisée par des personnes de 20 à 60 ans et plus : texte à
16 px minimum, contrastes élevés, cibles tactiles larges, libellés explicites
plutôt que des icônes seules, navigation clavier avec focus visible, et messages
d'erreur formulés en français courant plutôt qu'en jargon technique.

La palette des graphiques est validée pour les daltonismes (écart ΔE 24,7 en
protanopie, 33,6 en vision normale, contraste ≥ 3:1 sur fond blanc).
