import { ContactDetailContent } from '@/components/contacts/contact-detail-content'

interface ContactDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function ContactDetailPage({ params }: ContactDetailPageProps) {
  const { id } = await params

  return <ContactDetailContent contactId={id} />
}
