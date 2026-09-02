'use client'

import { FileDown, Printer } from 'lucide-react'
import {
  downloadAnnualReport, downloadMonthlyReport, downloadPropertyReport,
  type AnnualReportData, type MonthlyReportData, type PropertyReportData,
} from '@/lib/pdf'

/** Les données sont préparées côté serveur : le bouton ne fait que déclencher le PDF. */
export function MonthlyReportButton({ data }: { data: MonthlyReportData }) {
  return (
    <button type="button" onClick={() => downloadMonthlyReport(data)} className="btn-primary">
      <FileDown className="size-5" aria-hidden />
      Exporter en PDF
    </button>
  )
}

export function AnnualReportButton({ data }: { data: AnnualReportData }) {
  return (
    <button type="button" onClick={() => downloadAnnualReport(data)} className="btn-primary">
      <FileDown className="size-5" aria-hidden />
      Exporter en PDF
    </button>
  )
}

export function PropertyReportButton({ data }: { data: PropertyReportData }) {
  return (
    <button type="button" onClick={() => downloadPropertyReport(data)} className="btn-primary">
      <FileDown className="size-5" aria-hidden />
      Exporter en PDF
    </button>
  )
}

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-secondary">
      <Printer className="size-5" aria-hidden />
      Imprimer
    </button>
  )
}
