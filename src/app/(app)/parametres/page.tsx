import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight, BellRing, Database, History, RefreshCw, Shield, User,
} from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/ui/PageHeader'
import { PasswordForm, ProfileForm } from '@/components/settings/ProfileForm'
import {
  ExportBackupButton, RegenerateRentsButton, RestoreBackupButton,
} from '@/components/settings/BackupPanel'
import { NtfyPanel } from '@/components/settings/NtfyPanel'
import { rows, row } from '@/lib/supabase/rows'
import { USER_ROLE } from '@/lib/format'
import type { AppSettings, NotificationDelivery } from '@/lib/types'

export const metadata: Metadata = { title: 'Paramètres' }
export const dynamic = 'force-dynamic'

function Card({
  icon, title, description, children,
}: {
  icon: React.ReactNode
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="card p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          {icon}
        </span>
        <div>
          <h2 className="text-lg font-bold text-ink-900">{title}</h2>
          {description && <p className="mt-0.5 text-[15px] text-ink-500">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

export default async function SettingsPage() {
  const user = await requireUser()
  const supabase = await createClient()

  const [{ count: auditCount }, { data: settingsRow }, { data: deliveryRows }] = await Promise.all([
    supabase.from('audit_log').select('id', { count: 'exact', head: true }),
    supabase.from('app_settings').select('*').eq('id', 1).maybeSingle(),
    supabase.from('notification_deliveries').select('*')
      .order('sent_at', { ascending: false }).limit(5),
  ])

  return (
    <>
      <PageHeader title="Paramètres" subtitle="Compte, sécurité et maintenance des données." />

      <div className="space-y-6">
        <Card icon={<User className="size-5" />} title="Mon compte"
              description={`Connecté en tant que ${USER_ROLE[user.role]}.`}>
          <ProfileForm fullName={user.fullName} email={user.email} />
        </Card>

        <Card icon={<Shield className="size-5" />} title="Sécurité"
              description="Choisissez un mot de passe long et unique.">
          <PasswordForm />
        </Card>

        <Card
          icon={<BellRing className="size-5" />}
          title="Notifications sur mobile"
          description="Recevez une alerte sur votre téléphone dès qu'un loyer dépasse son échéance du nombre de jours choisi."
        >
          <NtfyPanel
            settings={row<AppSettings>(settingsRow)}
            deliveries={rows<NotificationDelivery>(deliveryRows)}
          />
        </Card>

        <Card icon={<Database className="size-5" />} title="Sauvegarde et restauration"
              description="Exportez régulièrement vos données : biens, locataires, contrats, loyers, paiements, dépenses et références de documents.">
          <div className="space-y-6">
            <ExportBackupButton />
            <div className="border-t border-ink-100 pt-6">
              <p className="mb-3 text-[15px] text-ink-600">
                La restauration réinsère les enregistrements d&apos;une sauvegarde sans rien supprimer.
              </p>
              <RestoreBackupButton />
            </div>
            <p className="rounded-lg bg-ink-50 px-4 py-3 text-sm text-ink-600">
              Les fichiers joints (contrats scannés, photos, factures) restent stockés dans
              Supabase Storage et ne sont pas inclus dans le fichier JSON : seules leurs
              références le sont. Supabase assure par ailleurs des sauvegardes
              automatiques de la base.
            </p>
          </div>
        </Card>

        <Card icon={<RefreshCw className="size-5" />} title="Maintenance"
              description="Les loyers sont générés automatiquement à chaque ouverture de l'application. Ce bouton force une vérification immédiate.">
          <RegenerateRentsButton />
        </Card>

        <Card icon={<History className="size-5" />} title="Historique des modifications"
              description="Chaque création, modification et suppression sur les biens, locataires, contrats, paiements et dépenses est enregistrée.">
          <Link href="/parametres/historique" className="btn-secondary">
            Consulter l&apos;historique
            {auditCount != null && (
              <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-bold text-ink-600">
                {auditCount}
              </span>
            )}
            <ArrowRight className="size-4.5" aria-hidden />
          </Link>
        </Card>
      </div>
    </>
  )
}
