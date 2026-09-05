/**
 * Génère le manuel d'utilisation en PDF.
 *
 * Les polices standard du PDF n'encodent pas le tiret cadratin, la puce ronde
 * ni l'oe lié : ils sont volontairement absents du texte, remplacés par des
 * équivalents qui s'impriment. Les accents français, « », ° et m³ passent.
 */
import { jsPDF } from '../node_modules/jspdf/dist/jspdf.node.min.js'
import { writeFileSync } from 'node:fs'

const INDIGO = [59, 74, 155]
const INDIGO_SOMBRE = [42, 52, 104]
const OR = [181, 136, 58]
const ENCRE = [27, 26, 23]
const GRIS = [87, 83, 74]
const GRIS_CLAIR = [157, 152, 140]

const M = 18            // marge
const L = 210 - M * 2   // largeur utile
const BAS = 273         // limite basse avant pied de page

const doc = new jsPDF({ unit: 'mm', format: 'a4' })
let y = 0
let page = 0
let chapitre = ''

const sommaire = []

function entete() {
  if (page === 0) return
  doc.setDrawColor(230, 227, 220)
  doc.setLineWidth(0.2)
  doc.line(M, 12, 210 - M, 12)
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GRIS_CLAIR)
  doc.text('GESTION LOCATIVE', M, 9)
  if (chapitre) doc.text(chapitre.toUpperCase(), 210 - M, 9, { align: 'right' })
}

function pied() {
  if (page === 0) return
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GRIS_CLAIR)
  doc.text(String(page), 105, 287, { align: 'center' })
}

function nouvellePage() {
  pied()
  doc.addPage()
  page += 1
  entete()
  y = 22
}

function place(hauteur) {
  if (y + hauteur > BAS) nouvellePage()
}

function titreChapitre(numero, texte) {
  if (y > 40) nouvellePage()
  chapitre = texte
  sommaire.push({ numero, texte, page: page })
  doc.setFillColor(...INDIGO)
  doc.rect(M, y, 8, 8, 'F')
  doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(255, 255, 255)
  doc.text(String(numero), M + 4, y + 5.6, { align: 'center' })
  doc.setFont('helvetica', 'bold').setFontSize(17).setTextColor(...ENCRE)
  doc.text(texte, M + 12, y + 6.2)
  y += 15
}

function titreSection(texte) {
  place(16)
  doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...INDIGO_SOMBRE)
  const lignes = doc.splitTextToSize(texte, L)
  doc.text(lignes, M, y)
  y += lignes.length * 6 + 2
}

function para(texte, options = {}) {
  const taille = options.taille ?? 10
  const couleur = options.couleur ?? GRIS
  doc.setFont('helvetica', options.gras ? 'bold' : 'normal').setFontSize(taille).setTextColor(...couleur)
  const lignes = doc.splitTextToSize(texte, options.largeur ?? L)
  for (const ligne of lignes) {
    place(6)
    doc.text(ligne, options.x ?? M, y)
    y += 5
  }
  y += 2.5
}

function étapes(liste) {
  doc.setFontSize(10)
  liste.forEach((texte, i) => {
    const lignes = doc.splitTextToSize(texte, L - 9)
    place(lignes.length * 5 + 2)
    doc.setFillColor(...INDIGO)
    doc.circle(M + 2.4, y - 1.4, 2.4, 'F')
    doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(255, 255, 255)
    doc.text(String(i + 1), M + 2.4, y - 0.6, { align: 'center' })
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...GRIS)
    doc.text(lignes, M + 9, y)
    y += lignes.length * 5 + 2
  })
  y += 1.5
}

function puces(liste) {
  doc.setFontSize(10)
  for (const texte of liste) {
    const lignes = doc.splitTextToSize(texte, L - 6)
    place(lignes.length * 5 + 1)
    doc.setFillColor(...GRIS_CLAIR)
    doc.circle(M + 1.4, y - 1.4, 0.8, 'F')
    doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...GRIS)
    doc.text(lignes, M + 6, y)
    y += lignes.length * 5 + 1
  }
  y += 2
}

/** Encadré : ce que l'application fait sans vous, ou un avertissement. */
function encadre(titre, texte, ton = 'info') {
  const fond = ton === 'alerte' ? [253, 246, 233] : [241, 243, 251]
  const trait = ton === 'alerte' ? [169, 117, 20] : INDIGO
  doc.setFont('helvetica', 'normal').setFontSize(9.5)
  const lignes = doc.splitTextToSize(texte, L - 14)
  const h = lignes.length * 4.6 + 13
  place(h + 3)
  doc.setFillColor(...fond)
  doc.roundedRect(M, y - 4, L, h, 1.5, 1.5, 'F')
  doc.setFillColor(...trait)
  doc.rect(M, y - 4, 1.2, h, 'F')
  doc.setFont('helvetica', 'bold').setFontSize(9.5).setTextColor(...trait)
  doc.text(titre, M + 6, y + 1.5)
  doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...GRIS)
  doc.text(lignes, M + 6, y + 7)
  y += h + 3
}

// =========================================================================
// COUVERTURE
// =========================================================================
doc.setFillColor(...INDIGO_SOMBRE)
doc.rect(0, 0, 210, 120, 'F')
doc.setFillColor(...OR)
doc.rect(0, 120, 210, 1.2, 'F')

doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(220, 190, 121)
doc.text('PATRIMOINE IMMOBILIER', M, 38)

doc.setFont('helvetica', 'bold').setFontSize(34).setTextColor(255, 255, 255)
doc.text('Manuel', M, 60)
doc.text("d'utilisation", M, 74)

doc.setFont('helvetica', 'normal').setFontSize(12).setTextColor(210, 214, 235)
doc.text('Gestion Locative', M, 90)
doc.setFontSize(10).setTextColor(180, 186, 215)
doc.text("Tout ce que l'application fait, et ce que vous avez à faire.", M, 99)

doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...GRIS)
doc.text('Adresse de connexion', M, 145)
doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(...INDIGO)
doc.text('https://gestion-loc-app.vercel.app', M, 153)

doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...GRIS)
const intro = doc.splitTextToSize(
  "Ce manuel est organisé par situation : cherchez ce que vous voulez faire, " +
  "suivez les étapes. Chaque chapitre précise aussi ce que l'application calcule " +
  "toute seule, pour que vous sachiez ce qu'il est inutile de saisir.", L)
doc.text(intro, M, 168)

doc.setFontSize(9).setTextColor(...GRIS_CLAIR)
doc.text('Document remis au propriétaire', M, 275)

// =========================================================================
// SOMMAIRE (rempli en fin de generation)
// =========================================================================
doc.addPage(); page = 1
const pageSommaire = doc.getNumberOfPages()
entete(); y = 26
doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(...ENCRE)
doc.text('Sommaire', M, y); y += 14

// =========================================================================
// 1. AVANT DE COMMENCER
// =========================================================================
nouvellePage()
titreChapitre(1, 'Avant de commencer')

titreSection('Se connecter')
étapes([
  "Ouvrez https://gestion-loc-app.vercel.app dans un navigateur, sur ordinateur, tablette ou téléphone.",
  "Saisissez votre adresse email et votre mot de passe.",
  "Cliquez sur Se connecter.",
])
encadre('Mot de passe oublié ou à changer',
  "Une fois connecté, allez dans Paramètres, section Sécurité. Si vous ne pouvez plus vous " +
  "connecter du tout, le mot de passe se réinitialise depuis le tableau de bord Supabase.")

titreSection('Le principe à retenir')
para("Vous saisissez des faits : un bien acheté, un locataire arrivé, un loyer encaissé, une " +
  "dépense payée. L'application se charge de tous les calculs qui en découlent. Vous n'avez " +
  "jamais à calculer un reste à payer, un total ou une rentabilité : si un chiffre apparaît " +
  "quelque part, c'est qu'il a été calculé à partir de ce que vous avez saisi.")
encadre("Règle d'or",
  "Si vous vous trouvez en train de faire un calcul de tête pour remplir un champ, arrêtez-vous : " +
  "c'est probablement que ce champ se remplit tout seul ailleurs.")

titreSection('Comment le menu est organise')
puces([
  "Gestion : ce que vous possédez et qui l'occupe. Biens, Locataires, Contrats.",
  "Finances : ce qui entre et ce qui sort. Loyers, Paiements, Dépenses, Eau et électricité.",
  "Analyse : ce que cela donne. Rentabilité, Rapports, Documents.",
])
para("En haut de chaque écran : une barre de recherche qui cherche partout à la fois, une cloche " +
  "qui compte vos alertes, et votre compte.")

// =========================================================================
// 2. METTRE EN PLACE
// =========================================================================
nouvellePage()
titreChapitre(2, 'Mettre en place')
para("Ces trois opérations se font une fois par bien et par locataire. L'ordre compte : un contrat " +
  "a besoin d'un bien et d'un locataire déjà enregistrés.")

titreSection('2.1  Ajouter un bien')
étapes([
  "Menu Biens, puis Ajouter un bien.",
  "Renseignez la référence (un identifiant à vous, par exemple BIEN-001) et le nom.",
  "Complétez l'adresse, le type, la surface et le nombre de chambres.",
  "Section Investissement : prix d'achat, frais d'achat, travaux initiaux.",
  "Section Location : le loyer mensuel de référence et les charges.",
  "Section Tarifs des compteurs : le prix du mètre cube d'eau et du kilowattheure.",
  "Cliquez sur Créer le bien.",
])
encadre("Calculé automatiquement",
  "L'investissement total s'affiché pendant que vous tapez : prix d'achat + frais d'achat + " +
  "travaux initiaux. C'est lui qui servira de base au calcul de la rentabilité. Le statut du bien " +
  "est Libre tant qu'aucun contrat n'est actif.")

titreSection('2.2  Ajouter un locataire')
étapes([
  "Menu Locataires, puis Ajouter un locataire.",
  "Renseignez au minimum le prénom et le nom.",
  "Complétez la CIN, le téléphone et l'email : ils servent à la recherche rapide et aux alertes.",
  "Le contact d'urgence et les notes sont facultatifs.",
  "Cliquez sur Créer le locataire.",
])

titreSection('2.3  Créer le contrat')
para("Le contrat relie un bien a un locataire. C'est lui qui déclenche toute la mécanique des loyers.")
étapes([
  "Menu Contrats, puis Nouveau contrat.",
  "Choisissez le bien : son loyer et ses charges de référence se pré-remplissent.",
  "Choisissez le locataire.",
  "Indiquez la date de début. Laissez la date de fin vide pour une durée indéterminée.",
  "Ajustez le loyer et les charges si ce contrat diffère de la référence du bien.",
  "Indiquez la caution et le jour d'échéance mensuel.",
  "Cliquez sur Créer le contrat.",
])
encadre("Ce qui se passe immédiatement",
  "Le bien passe en statut Loue. Les loyers mensuels sont générés automatiquement, depuis la date " +
  "de debut jusqu'au mois en cours : si le bail a commencé il y a trois mois, trois loyers " +
  "apparaissent aussitôt. Chaque mois suivant s'ajoutera tout seul.")
encadre("Un seul contrat actif par bien",
  "L'application refuse un second contrat actif sur le même bien. C'est voulu : deux baux " +
  "simultanés sur un logement produiraient des loyers en double. Clôturez le contrat en cours avant " +
  "d'en creer un nouveau.", 'alerte')

// =========================================================================
// 3. AU QUOTIDIEN
// =========================================================================
nouvellePage()
titreChapitre(3, 'Au quotidien')

titreSection('3.1  Encaisser un loyer')
étapes([
  "Menu Loyers. Le mois en cours s'affiche par defaut.",
  "Repérez la ligne du locataire concerne.",
  "Cliquez sur Paiement pour saisir un montant, ou sur Solder pour encaisser la totalité du reste en espèces.",
  "Vérifiez le montant, la date, le mode de paiement, et ajoutez une référence si besoin.",
  "Cliquez sur Enregistrer le paiement.",
])
encadre('Calculé automatiquement',
  "Le total payé, le reste à payer et le statut du loyer se mettent à jour immédiatement. " +
  "Le tableau de bord, la rentabilité du bien et la fiche du locataire suivent sans action de votre part.")

titreSection('3.2  Un paiement partiel, ou en plusieurs fois')
para("Saisissez simplement le montant reçu. Le loyer passe en statut Partiel et le reste s'affiché. " +
  "Quand le locataire complète, saisissez un second paiement sur le même mois : les deux " +
  "s'additionnent et le loyer bascule en Payé dès que le total atteint le montant dû.")
encadre('Les quatre statuts',
  "A payer : l'échéance n'est pas encore passée.   Payé : le montant dû est atteint.   " +
  "Partiel : une partie a été reçue.   Impayé : l'échéance est passée et rien n'a été reçu.")

titreSection('3.3  Encaisser la caution')
para("La caution ne se verse qu'une fois, en début de bail. Elle est donc suivie à part des loyers " +
  "mensuels, dans sa propre section.")
étapes([
  "Menu Loyers. En haut de l'écran, section Cautions des contrats en cours.",
  "Cliquez sur Verser sur la ligne concernee.",
  "Saisissez le montant reçu, la date et le mode de paiement.",
])
para("Comme pour les loyers, une caution peut être réglée en plusieurs fois : les versements " +
  "s'additionnent et le statut passe de À verser à Partielle puis Versée.")

titreSection("3.4  Relevér l'eau et l'électricité")
étapes([
  "Menu Eau et elec., puis Nouveau relevé.",
  "Choisissez le bien : les tarifs et le dernier index connu se pré-remplissent.",
  "Indiquez le mois concerné et la date du relevé.",
  "Saisissez le nouvel index d'eau, puis celui d'électricité.",
  "Vérifiez les montants calculés, puis enregistrez.",
])
encadre('Calculé automatiquement',
  "Consommation = nouvel index moins ancien index. Montant = consommation multipliée par le tarif. " +
  "Les deux cases se remplissent pendant que vous tapez et ne sont pas modifiables : elles se " +
  "deduisent des index. Le locataire est identifié tout seul, d'après le contrat en cours sur le mois choisi.")
encadre('Si un index est inférieur au précédent',
  "L'application refuse l'enregistrement. Dans la quasi-totalité des cas c'est une faute de frappe. " +
  "Si le compteur a réellement été remplacé, notez-le dans le champ Observations et saisissez " +
  "l'ancien index a zero.", 'alerte')

titreSection('3.5  Enregistrer une dépense')
étapes([
  "Menu Dépenses, puis Ajouter une dépense. Vous pouvez aussi partir de la fiche du bien.",
  "Choisissez le bien concerné et la catégorie.",
  "Saisissez le montant, la date et une description.",
])
encadre('Calculé automatiquement',
  "La dépense est immédiatement déduite du revenu net du bien et de sa rentabilité. Les totaux " +
  "mensuels et annuels se recalculent seuls.")

titreSection('3.6  Joindre un document')
para("Contrats scannés, copies de CIN, factures, photos : chaque document reste rattaché à " +
  "l'élément qu'il concerne.")
étapes([
  "Ouvrez la fiche du bien, du locataire, du contrat ou du loyer concerné.",
  "Dans l'encadré Documents, cliquez sur Ajouter.",
  "Choisissez le fichier, son type et un nom d'affichage.",
])
para("Le menu Documents regroupe tout, avec des filtres par type et par rattachement. Les fichiers " +
  "sont stockés de façon privée : ils ne sont accessibles qu'une fois connecté.")

// =========================================================================
// 4. SUIVRE ET DECIDER
// =========================================================================
nouvellePage()
titreChapitre(4, 'Suivre et décider')

titreSection('4.1  Le tableau de bord')
para("C'est la page d'accueil. Elle repond a la question la plus fréquente en haut d'écran : " +
  "où en est l'encaissement du mois. Le montant encaissé, une barre de progression vers le montant " +
  "attendu, et le reste à percevoir.")
puces([
  "Patrimoine : nombre de biens, loués, libres, et nombre de locataires.",
  "Résultat : loyers encaissés, revenu net, rentabilité globale, loyers en retard.",
  "Quatre graphiques sur douze mois : loyers et dépenses, revenu net, impayés, rentabilité par bien.",
  "En bas, la liste des impayés à traiter, cliquable.",
])

titreSection('4.2  Repérer et traiter les impayés')
étapes([
  "Depuis le tableau de bord, cliquez sur la carte Loyers en retard.",
  "Ou : menu Loyers, filtre Statut sur Impayé.",
  "Chaque ligne indique le nombre de jours de retard et le montant restant.",
  "Cliquez sur le mois pour ouvrir la fiche du loyer et voir l'historique des paiements.",
])

titreSection('4.3  La rentabilité')
para("Menu Rentabilité. Chaque bien est classé, du plus rentable au moins rentable.")
encadre('Comment elle est calculée',
  "Revenus : loyers réellement encaisses sur les douze derniers mois.   " +
  "Dépenses : toutes les dépenses du bien sur la même période.   " +
  "Revenu net = revenus moins dépenses.   " +
  "Rentabilité nette = revenu net annuel divisé par l'investissement total, en pourcentage.")
para("La rentabilité brute, affichée à côté, ignore les dépenses et les impayés : elle correspond " +
  "au loyer de référence multiplié par douze. L'ecart entre les deux mesure ce que vous coûtent " +
  "réellement les charges et la vacance.")

titreSection('4.4  Rechercher')
para("La barre en haut de l'ecran cherche simultanément dans les locataires, les biens, les " +
  "contrats et les loyers. Vous pouvez taper un nom, un numéro de CIN, un téléphone, une référence " +
  "de bien ou une adresse.")

// =========================================================================
// 5. EDITER DES DOCUMENTS
// =========================================================================
nouvellePage()
titreChapitre(5, 'Éditer des documents')
para("Tous les documents ci-dessous se téléchargent en PDF, prêts à être imprimés ou envoyés.")

titreSection('5.1  Un reçu de paiement')
étapes([
  "Menu Paiements, ou fiche du loyer concerné.",
  "Cliquez sur l'icône de téléchargement sur la ligne du paiement.",
])
para("Le reçu porte le locataire, le bien, le mois concerné, le montant reçu, le mode de paiement " +
  "et le reste éventuel. Un emplacement de signature est prévu.")

titreSection('5.2  Le rapport mensuel')
étapes([
  "Menu Rapports, puis Rapport mensuel.",
  "Choisissez le mois avec les flèches ou le sélecteur.",
  "Cliquez sur Exporter en PDF.",
])
para("Il contient les loyers prévus et encaisses, les montants restants, les impayés, les dépenses " +
  "et le revenu net, avec le détail ligne par ligne.")

titreSection('5.3  Le rapport annuel')
para("Même principe, sur une année civile : le détail mois par mois, les totaux, la rentabilité du " +
  "patrimoine et le classement des biens.")

titreSection('5.4  Le rapport par bien')
para("Depuis Rapports, choisissez un bien dans la liste du bas. Vous obtenez son investissement, " +
  "ses revenus, ses dépenses, sa rentabilité, l'historique complet de ses loyers et de ses dépenses.")

// =========================================================================
// 6. ETRE PREVENU
// =========================================================================
nouvellePage()
titreChapitre(6, 'Être prévenu')

titreSection("6.1  Les alertes dans l'application")
para("La cloche en haut à droite compte les alertes en attente. Elles se calculent en temps réel :")
puces([
  "Loyers impayés : échéance passée, aucun paiement reçu.",
  "Paiements partiels : une partie seulement a été versée.",
  "Loyers bientôt dus : échéance dans les sept prochains jours.",
  "Contrats et assurances arrivant à expiration dans les soixante jours.",
  "Biens en maintenance.",
])
para("Vous pouvez masquer une alerte : elle reste active mais ne compte plus dans le badge.")

titreSection('6.2  Les alertes sur votre téléphone')
para("L'application peut vous prévenir sur votre mobile dès qu'un loyer dépasse son échéance du " +
  "nombre de jours que vous choisissez, même si vous n'ouvrez pas l'application.")
étapes([
  "Installez l'application ntfy sur votre téléphone, depuis l'App Store ou Google Play.",
  "Dans Paramètres de Gestion Locative, section Notifications sur mobile, cliquez sur Générer pour obtenir un sujet.",
  "Dans l'application ntfy, abonnez-vous à ce sujet exactement tel qu'il est écrit.",
  "Cochez Activer les alertes de retard, choisissez le délai en jours, puis Enregistrer.",
  "Cliquez sur Envoyer une notification de test et vérifiez la réception.",
])
encadre('Ce que contient une alerte',
  "Le nom du locataire, le bien et sa référence, le détail loyer et charges, le total dû, " +
  "l'échéance, le nombre de jours de retard et le téléphone du locataire. Un appui sur la " +
  "notification ouvre directement la fiche du loyer.")
encadre('Le sujet vaut mot de passe',
  "Chez ntfy il n'y a ni compte ni mot de passe : le nom du sujet est le seul secret. Quiconque le " +
  "connait recevrait vos alertes, donc les noms de vos locataires et les montants dus. Utilisez le " +
  "sujet généré aléatoirement plutôt qu'un nom simple, et ne le communiquez pas.", 'alerte')
para("La vérification a lieu chaque matin. Un même loyer ne déclenche qu'une seule alerte : votre " +
  "téléphone ne sonnera pas tous les jours pour le même retard.")

// =========================================================================
// 7. SITUATIONS PARTICULIERES
// =========================================================================
nouvellePage()
titreChapitre(7, 'Situations particulières')

titreSection('7.1  Le locataire s\'en va')
étapes([
  "Ouvrez le contrat concerné, menu Contrats.",
  "Cliquez sur Clôturer le contrat.",
  "Choisissez le motif : Terminé si le bail arrive à son terme, Résilié en cas de fin anticipée.",
  "Indiquez la date de fin, puis confirmez.",
])
encadre('Ce qui se passe',
  "Le bien redevient Libre automatiquement. Aucun loyer ne sera généré après la date de fin. " +
  "Les loyers déjà générés, les paiements et l'historique sont conservés : vous gardez la trace " +
  "complète de la période de location.")

titreSection('7.2  Un nouveau locataire dans le même bien')
para("Clôturez d'abord le contrat précédent, puis creez le nouveau contrat. Le bien repasse en " +
  "Loue et ses loyers reprennent à la date de début du nouveau bail.")

titreSection('7.3  Changer le loyer en cours de bail')
para("Ouvrez le contrat, cliquez sur Modifier et ajustez le montant.")
encadre('Ce qui est recalculé',
  "Les mois à venir non encore réglés prennent le nouveau montant. Les mois déjà payés restent " +
  "inchangés : modifier un loyer ne doit jamais réécrire le passé.")

titreSection('7.4  Un bien en travaux')
para("Ouvrez la fiche du bien et cliquez sur Mettre en maintenance. Le bien apparaît alors comme " +
  "indisponible et une alerte le rappelle. Cliquez sur Terminer la maintenance pour revenir a " +
  "l'état précédent. Un bien sous contrat actif reste Loué : la maintenance ne suspend pas un bail.")

titreSection('7.5  Corriger une erreur de saisie')
para("Les paiements, dépenses et relevés se modifient et se suppriment depuis leur ligne. Tous les " +
  "totaux se recalculent immédiatement. Un bien ou un locataire rattaché à un contrat ne peut pas " +
  "etre supprime : l'application vous l'indiquera plutôt que de détruire un historique financier.")

// =========================================================================
// 8. ENTRETIEN
// =========================================================================
nouvellePage()
titreChapitre(8, 'Entretien et sécurité')

titreSection('8.1  Sauvegarder vos données')
étapes([
  "Menu Paramètres, section Sauvegarde et restauration.",
  "Cliquez sur Télécharger la sauvegarde.",
  "Conservez le fichier JSON obtenu en lieu sûr.",
])
para("Faites-le régulièrement, par exemple une fois par mois. Le fichier contient tous vos biens, " +
  "locataires, contrats, loyers, paiements, dépenses, relevés, cautions et références de documents.")
encadre('Les fichiers joints ne sont pas dans le JSON',
  "Les contrats scannés et les photos restent stockés en ligne : seules leurs références figurent " +
  "dans la sauvegarde. L'hébergeur assure par ailleurs ses propres sauvegardes automatiques.")

titreSection('8.2  Restaurer')
para("Cliquez sur Restaurer une sauvegarde, choisissez le fichier, tapez RESTAURER en majuscules, " +
  "puis confirmez.")
encadre('La restauration ne supprime rien',
  "Chaque enregistrement est réinséré ou mis à jour sur son identifiant. Ce qui existe aujourd'hui " +
  "et ne figure pas dans la sauvegarde est conservé. Une restauration ne peut donc pas détruire des " +
  "données saisies après la sauvegarde.")

titreSection('8.3  Historique des modifications')
para("Paramètres, puis Consulter l'historique. Chaque création, modification et suppression est " +
  "enregistrée avec sa date et les champs concernés. Utile pour retrouver qui a changé quoi, ou " +
  "comprendre un écart.")

titreSection('8.4  Votre mot de passe')
para("Paramètres, section Sécurité. Choisissez un mot de passe long et unique. Évitez les suites " +
  "de chiffres : ce sont les premières essayées.")

// =========================================================================
// 9. RECAPITULATIF
// =========================================================================
nouvellePage()
titreChapitre(9, "Ce que l'application calcule seule")
para("Vous n'avez jamais à saisir ni vérifier ces valeurs. Elles se recalculent à chaque opération.")

const calculs = [
  ['Investissement total', "Prix d'achat + frais d'achat + travaux initiaux"],
  ['Loyers mensuels', "Générés pour chaque contrat actif, depuis la date de début"],
  ['Montant dû du mois', 'Loyer + charges du contrat'],
  ['Total payé', "Somme de tous les paiements enregistrés sur le mois"],
  ['Reste à payer', 'Montant dû moins total payé'],
  ['Statut du loyer', "A payer, Paye, Partiel ou Impayé, selon le paye et l'échéance"],
  ['Statut du bien', 'Loué si un contrat est actif, sinon Libre'],
  ['Caution versée et reste', 'Somme des versements, comparés au montant du bail'],
  ["Consommation d'eau et d'électricité", 'Nouvel index moins ancien index'],
  ['Montants eau et électricité', 'Consommation multipliée par le tarif'],
  ['Revenu net', 'Loyers encaissés moins dépenses'],
  ['Rentabilité nette', 'Revenu net sur douze mois divise par investissement total'],
  ['Totaux mensuels et annuels', 'Sommes des loyers, paiements et dépenses de la période'],
  ['Alertes', 'Deduites des échéances, des paiements et des dates de fin'],
]

doc.setFontSize(9.5)
for (const [quoi, comment] of calculs) {
  const lignesC = doc.splitTextToSize(comment, L - 62)
  const h = Math.max(lignesC.length * 4.4, 4.4) + 3.5
  place(h)
  doc.setFont('helvetica', 'bold').setTextColor(...ENCRE)
  doc.text(doc.splitTextToSize(quoi, 58), M, y)
  doc.setFont('helvetica', 'normal').setTextColor(...GRIS)
  doc.text(lignesC, M + 62, y)
  y += h
  doc.setDrawColor(238, 236, 230)
  doc.setLineWidth(0.15)
  doc.line(M, y - 2.5, 210 - M, y - 2.5)
}

// =========================================================================
// 10. QUESTIONS FREQUENTES
// =========================================================================
nouvellePage()
titreChapitre(10, 'Questions fréquentes')

const faq = [
  ["Un loyer du mois n'apparaît pas.",
   "Vérifiez que le contrat est bien en statut Actif et que sa date de début precede le mois " +
   "concerne. Vous pouvez forcer une vérification immédiate depuis Paramètres, section Maintenance."],
  ["J'ai encaissé un loyer mais le tableau de bord ne bouge pas.",
   "Rafraîchissez la page. Les chiffres sont calcules a l'ouverture de chaque écran."],
  ["Puis-je supprimer un bien loué ?",
   "Non. L'application refuse tant qu'un contrat y est rattaché, car cela détruirait les loyers et " +
   "les paiements associes. Clôturez le contrat, ou conservez le bien pour garder l'historique."],
  ["Le locataire paie en avance, sur plusieurs mois.",
   "Enregistrez un paiement sur chaque mois concerné. Un paiement est toujours rattache a un mois " +
   "precis, ce qui permet de savoir exactement ce qui est soldé."],
  ["Les montants d'eau et d'électricité entrent-ils dans la rentabilité ?",
   "Non. Ce sont des sommes refacturées qui transitent par vous, pas des revenus locatifs. Elles " +
   "sont suivies a part."],
  ["Puis-je utiliser l'application sur téléphone ?",
   "Oui. Les écrans s'adaptent. Les tableaux larges défilent horizontalement du doigt."],
  ["Plusieurs personnes peuvent-elles se connecter ?",
   "Oui, avec des comptes distincts et trois niveaux : propriétaire et gestionnaire peuvent tout " +
   "modifier, lecteur consulte sans rien changer."],
  ["Comment recuperer une donnée supprimée par erreur ?",
   "Restaurez la dernière sauvegarde : elle réinsère sans rien écraser d'autre. L'historique des " +
   "modifications permet aussi de retrouver la valeur d'origine."],
]

for (const [q, r] of faq) {
  const lq = doc.splitTextToSize(q, L)
  const lr = doc.splitTextToSize(r, L)
  place(lq.length * 5 + lr.length * 4.8 + 8)
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(...INDIGO_SOMBRE)
  doc.text(lq, M, y); y += lq.length * 5 + 1.5
  doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(...GRIS)
  doc.text(lr, M, y); y += lr.length * 4.8 + 6
}

place(30)
doc.setFillColor(...INDIGO_SOMBRE)
doc.roundedRect(M, y, L, 24, 2, 2, 'F')
doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(255, 255, 255)
doc.text('Une question qui ne figure pas ici ?', M + 8, y + 10)
doc.setFont('helvetica', 'normal').setFontSize(9.5).setTextColor(200, 206, 232)
doc.text("Contactez la personne qui vous a remis l'application.", M + 8, y + 17)

pied()

// =========================================================================
// SOMMAIRE : rempli maintenant que les pages sont connues
// =========================================================================
doc.setPage(pageSommaire)
let ys = 40
for (const s of sommaire) {
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(...INDIGO)
  doc.text(String(s.numéro), M, ys)
  doc.setFont('helvetica', 'normal').setFontSize(11).setTextColor(...ENCRE)
  doc.text(s.texte, M + 9, ys)
  const largeurTitre = doc.getTextWidth(s.texte)
  doc.setDrawColor(225, 222, 214)
  doc.setLineDashPattern([0.6, 1.2], 0)
  doc.line(M + 11 + largeurTitre, ys - 1, 210 - M - 8, ys - 1)
  doc.setLineDashPattern([], 0)
  doc.setFont('helvetica', 'bold').setTextColor(...GRIS)
  doc.text(String(s.page), 210 - M, ys, { align: 'right' })
  ys += 11
}

writeFileSync('/Users/yassminesmachine/Desktop/dashboard-loc/docs/manuel-utilisation.pdf',
  Buffer.from(doc.output('arraybuffer')))
console.log(`manuel genere : ${doc.getNumberOfPages()} pages`)
