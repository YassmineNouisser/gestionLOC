'use client'

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { moneyExact, monthLabel, date as fmtDate, percent, PAYMENT_METHOD } from './format'

/**
 * jsPDF utilise l'encodage WinAnsi : les espaces fines insécables produites
 * par Intl.NumberFormat s'affichent mal. On les remplace par des espaces simples.
 */
function ascii(v: string): string {
  return v.replace(/[\u202f\u00a0\u2009]/g, ' ')
}

const M = (v: number | null | undefined) => ascii(moneyExact(v))
const P = (v: number | null | undefined) => ascii(percent(v))

const BRAND: [number, number, number] = [33, 63, 228]
const INK: [number, number, number] = [22, 26, 39]
const SOFT: [number, number, number] = [107, 116, 136]

interface HeaderOptions {
  title: string
  subtitle?: string
  meta?: string[]
}

function header(doc: jsPDF, { title, subtitle, meta = [] }: HeaderOptions): number {
  doc.setFillColor(...BRAND)
  doc.rect(0, 0, 210, 4, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...BRAND)
  doc.text('GESTION LOCATIVE', 14, 16)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...INK)
  doc.text(ascii(title), 14, 27)

  let y = 34
  if (subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(...SOFT)
    doc.text(ascii(subtitle), 14, y)
    y += 6
  }

  if (meta.length) {
    doc.setFontSize(9)
    doc.setTextColor(...SOFT)
    meta.forEach((line) => {
      doc.text(ascii(line), 14, y)
      y += 4.5
    })
  }

  doc.setDrawColor(226, 230, 238)
  doc.line(14, y + 1, 196, y + 1)
  return y + 8
}

function footer(doc: jsPDF, generatedOn: string) {
  const pages = doc.getNumberOfPages()
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...SOFT)
    doc.text(ascii(`Document généré le ${generatedOn}`), 14, 287)
    doc.text(`Page ${i} / ${pages}`, 196, 287, { align: 'right' })
  }
}

/** Bloc d'indicateurs : deux colonnes de libellé / valeur. */
function summaryBlock(
  doc: jsPDF,
  startY: number,
  entries: [string, string][],
): number {
  autoTable(doc, {
    startY,
    body: entries.map(([k, v]) => [ascii(k), ascii(v)]),
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: { top: 2, bottom: 2, left: 0, right: 0 } },
    columnStyles: {
      0: { textColor: SOFT, cellWidth: 90 },
      1: { fontStyle: 'bold', textColor: INK, halign: 'right', cellWidth: 92 },
    },
    margin: { left: 14, right: 14 },
  })
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
}

function tableStyles() {
  return {
    theme: 'striped' as const,
    headStyles: { fillColor: BRAND, textColor: [255, 255, 255] as [number, number, number], fontStyle: 'bold' as const, fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 2.5, textColor: INK },
    alternateRowStyles: { fillColor: [247, 248, 250] as [number, number, number] },
    margin: { left: 14, right: 14 },
  }
}

function today(): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date())
}

// ---------------------------------------------------------------------------
// Reçu de paiement
// ---------------------------------------------------------------------------
export interface ReceiptData {
  paymentId: string
  amount: number
  paymentDate: string
  method: keyof typeof PAYMENT_METHOD
  reference: string | null
  periodMonth: string
  amountDue: number
  amountPaid: number
  balance: number
  tenantName: string
  tenantCin: string | null
  propertyName: string
  propertyReference: string
  propertyAddress: string | null
}

export function downloadReceipt(d: ReceiptData) {
  const doc = new jsPDF()
  let y = header(doc, {
    title: 'Reçu de paiement',
    subtitle: `N° ${d.paymentId.slice(0, 8).toUpperCase()}`,
    meta: [`Émis le ${fmtDate(d.paymentDate)}`],
  })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...INK)
  doc.text('Locataire', 14, y)
  doc.text('Bien loué', 110, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...SOFT)
  y += 6
  doc.text(ascii(d.tenantName), 14, y)
  doc.text(ascii(d.propertyName), 110, y)
  y += 5
  if (d.tenantCin) doc.text(ascii(`CIN ${d.tenantCin}`), 14, y)
  doc.text(ascii(d.propertyReference), 110, y)
  y += 5
  if (d.propertyAddress) {
    doc.text(ascii(doc.splitTextToSize(d.propertyAddress, 80)[0]), 110, y)
    y += 5
  }

  y += 6

  // Montant réglé, mis en avant
  doc.setFillColor(238, 244, 255)
  doc.roundedRect(14, y, 182, 22, 2, 2, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...SOFT)
  doc.text('MONTANT REÇU', 20, y + 8)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.setTextColor(...BRAND)
  doc.text(M(d.amount), 20, y + 17)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...SOFT)
  doc.text(ascii(`Mode : ${PAYMENT_METHOD[d.method]}`), 190, y + 10, { align: 'right' })
  if (d.reference) doc.text(ascii(`Réf. ${d.reference}`), 190, y + 16, { align: 'right' })

  y += 30

  autoTable(doc, {
    ...tableStyles(),
    startY: y,
    head: [['Période', 'Montant dû', 'Total payé', 'Reste à payer']],
    body: [[
      ascii(monthLabel(d.periodMonth)),
      M(d.amountDue),
      M(d.amountPaid),
      M(d.balance),
    ]],
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
  })

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...SOFT)
  doc.text(
    ascii(
      d.balance > 0
        ? `Ce reçu atteste du paiement partiel ci-dessus. Un solde de ${M(d.balance)} reste dû pour cette période.`
        : "Ce reçu atteste du règlement intégral du loyer pour la période indiquée.",
    ),
    14, y, { maxWidth: 182 },
  )

  y += 24
  doc.setTextColor(...INK)
  doc.text('Signature du bailleur', 140, y)
  doc.setDrawColor(200, 204, 216)
  doc.line(140, y + 16, 196, y + 16)

  footer(doc, today())
  doc.save(`recu-${d.periodMonth.slice(0, 7)}-${d.tenantName.replace(/\s+/g, '-').toLowerCase()}.pdf`)
}

// ---------------------------------------------------------------------------
// Rapport mensuel
// ---------------------------------------------------------------------------
export interface MonthlyReportData {
  period: string
  totals: {
    loyersPrevus: number
    loyersEncaisses: number
    montantRestant: number
    impayes: number
    depenses: number
    revenuNet: number
  }
  rents: {
    property: string
    tenant: string
    due: number
    paid: number
    balance: number
    status: string
  }[]
  expenses: { property: string; category: string; date: string; description: string; amount: number }[]
}

export function downloadMonthlyReport(d: MonthlyReportData) {
  const doc = new jsPDF()
  let y = header(doc, {
    title: 'Rapport mensuel',
    subtitle: monthLabel(d.period),
  })

  y = summaryBlock(doc, y, [
    ['Loyers prévus', M(d.totals.loyersPrevus)],
    ['Loyers encaissés', M(d.totals.loyersEncaisses)],
    ['Montant restant', M(d.totals.montantRestant)],
    ['Dont impayés (échéance dépassée)', M(d.totals.impayes)],
    ['Dépenses du mois', M(d.totals.depenses)],
    ['Revenu net', M(d.totals.revenuNet)],
  ])

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...INK)
  doc.text('Détail des loyers', 14, y)

  autoTable(doc, {
    ...tableStyles(),
    startY: y + 3,
    head: [['Bien', 'Locataire', 'Dû', 'Payé', 'Reste', 'Statut']],
    body: d.rents.map((r) => [
      ascii(r.property), ascii(r.tenant), M(r.due), M(r.paid), M(r.balance), ascii(r.status),
    ]),
    columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
  })

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12

  if (d.expenses.length > 0) {
    if (y > 235) { doc.addPage(); y = 20 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...INK)
    doc.text('Détail des dépenses', 14, y)

    autoTable(doc, {
      ...tableStyles(),
      startY: y + 3,
      head: [['Date', 'Bien', 'Catégorie', 'Description', 'Montant']],
      body: d.expenses.map((e) => [
        ascii(fmtDate(e.date)), ascii(e.property), ascii(e.category),
        ascii(e.description || '—'), M(e.amount),
      ]),
      columnStyles: { 4: { halign: 'right' } },
    })
  }

  footer(doc, today())
  doc.save(`rapport-mensuel-${d.period.slice(0, 7)}.pdf`)
}

// ---------------------------------------------------------------------------
// Rapport annuel
// ---------------------------------------------------------------------------
export interface AnnualReportData {
  year: number
  months: {
    period: string
    loyersPrevus: number
    loyersEncaisses: number
    montantRestant: number
    depenses: number
    revenuNet: number
  }[]
  totals: {
    loyersPrevus: number
    loyersEncaisses: number
    montantRestant: number
    depenses: number
    revenuNet: number
  }
  investissement: number
  rentabilite: number | null
  properties: { name: string; revenus: number; depenses: number; net: number; rentabilite: number | null }[]
}

export function downloadAnnualReport(d: AnnualReportData) {
  const doc = new jsPDF()
  let y = header(doc, { title: 'Rapport annuel', subtitle: `Année ${d.year}` })

  y = summaryBlock(doc, y, [
    ['Loyers prévus sur l’année', M(d.totals.loyersPrevus)],
    ['Loyers encaissés', M(d.totals.loyersEncaisses)],
    ['Montant restant', M(d.totals.montantRestant)],
    ['Dépenses', M(d.totals.depenses)],
    ['Revenu net', M(d.totals.revenuNet)],
    ['Investissement total du patrimoine', M(d.investissement)],
    ['Rentabilité nette', P(d.rentabilite)],
  ])

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...INK)
  doc.text('Détail par mois', 14, y)

  autoTable(doc, {
    ...tableStyles(),
    startY: y + 3,
    head: [['Mois', 'Prévus', 'Encaissés', 'Restant', 'Dépenses', 'Revenu net']],
    body: d.months.map((m) => [
      ascii(monthLabel(m.period)), M(m.loyersPrevus), M(m.loyersEncaisses),
      M(m.montantRestant), M(m.depenses), M(m.revenuNet),
    ]),
    foot: [[
      'Total', M(d.totals.loyersPrevus), M(d.totals.loyersEncaisses),
      M(d.totals.montantRestant), M(d.totals.depenses), M(d.totals.revenuNet),
    ]],
    footStyles: { fillColor: [238, 240, 244], textColor: INK, fontStyle: 'bold' },
    columnStyles: {
      1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' },
      4: { halign: 'right' }, 5: { halign: 'right' },
    },
  })

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12

  if (d.properties.length > 0) {
    if (y > 230) { doc.addPage(); y = 20 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...INK)
    doc.text('Rentabilité par bien', 14, y)

    autoTable(doc, {
      ...tableStyles(),
      startY: y + 3,
      head: [['Bien', 'Revenus', 'Dépenses', 'Revenu net', 'Rentabilité']],
      body: d.properties.map((p) => [
        ascii(p.name), M(p.revenus), M(p.depenses), M(p.net), P(p.rentabilite),
      ]),
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } },
    })
  }

  footer(doc, today())
  doc.save(`rapport-annuel-${d.year}.pdf`)
}

// ---------------------------------------------------------------------------
// Rapport par bien
// ---------------------------------------------------------------------------
export interface PropertyReportData {
  property: {
    name: string
    reference: string
    address: string
    investissement: number
    revenus: number
    depenses: number
    net: number
    rentabiliteNette: number | null
    rentabiliteBrute: number | null
  }
  rents: { period: string; due: number; paid: number; balance: number; status: string }[]
  expenses: { date: string; category: string; description: string; amount: number }[]
}

export function downloadPropertyReport(d: PropertyReportData) {
  const doc = new jsPDF()
  let y = header(doc, {
    title: 'Rapport par bien',
    subtitle: d.property.name,
    meta: [d.property.reference, d.property.address].filter(Boolean),
  })

  y = summaryBlock(doc, y, [
    ['Investissement total', M(d.property.investissement)],
    ['Revenus (loyers encaissés)', M(d.property.revenus)],
    ['Dépenses', M(d.property.depenses)],
    ['Revenu net', M(d.property.net)],
    ['Rentabilité nette (12 mois)', P(d.property.rentabiliteNette)],
    ['Rentabilité brute', P(d.property.rentabiliteBrute)],
  ])

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(...INK)
  doc.text('Historique des loyers', 14, y)

  autoTable(doc, {
    ...tableStyles(),
    startY: y + 3,
    head: [['Mois', 'Dû', 'Payé', 'Reste', 'Statut']],
    body: d.rents.map((r) => [
      ascii(monthLabel(r.period)), M(r.due), M(r.paid), M(r.balance), ascii(r.status),
    ]),
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
  })

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12

  if (d.expenses.length > 0) {
    if (y > 235) { doc.addPage(); y = 20 }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...INK)
    doc.text('Historique des dépenses', 14, y)

    autoTable(doc, {
      ...tableStyles(),
      startY: y + 3,
      head: [['Date', 'Catégorie', 'Description', 'Montant']],
      body: d.expenses.map((e) => [
        ascii(fmtDate(e.date)), ascii(e.category), ascii(e.description || '—'), M(e.amount),
      ]),
      columnStyles: { 3: { halign: 'right' } },
    })
  }

  footer(doc, today())
  doc.save(`rapport-bien-${d.property.reference.toLowerCase()}.pdf`)
}
