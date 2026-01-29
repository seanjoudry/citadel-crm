import 'dotenv/config'
import pg from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)

// Prisma v7 ESM import
const { PrismaClient } = await import('../node_modules/.prisma/client/client.js')
const prisma = new PrismaClient({ adapter })

const OUTBOUND_TYPES = [
  'CALL_OUTBOUND',
  'TEXT_OUTBOUND',
  'EMAIL_OUTBOUND',
  'MEETING',
  'MAIL_SENT',
] as const

const ALL_INTERACTION_TYPES = [
  'CALL_INBOUND',
  'CALL_OUTBOUND',
  'CALL_MISSED',
  'TEXT_INBOUND',
  'TEXT_OUTBOUND',
  'EMAIL_INBOUND',
  'EMAIL_OUTBOUND',
  'MEETING',
  'MAIL_SENT',
  'MAIL_RECEIVED',
  'NOTE',
  'OTHER',
] as const

type InteractionType = (typeof ALL_INTERACTION_TYPES)[number]

async function main() {
  console.log('Seeding database...')

  // Clear existing data in reverse dependency order
  await prisma.interaction.deleteMany()
  await prisma.reminder.deleteMany()
  await prisma.notableDate.deleteMany()
  await prisma.contactTag.deleteMany()
  await prisma.contactGroup.deleteMany()
  await prisma.contact.deleteMany()
  await prisma.tag.deleteMany()
  await prisma.group.deleteMany()
  await prisma.region.deleteMany()
  await prisma.settings.deleteMany()

  // Seed settings
  await prisma.settings.create({
    data: { key: 'attention_threshold_days', value: '30' },
  })

  // Seed tags
  const tags = await Promise.all([
    prisma.tag.create({ data: { name: 'VIP', color: '#ef4444' } }),
    prisma.tag.create({ data: { name: 'Family', color: '#f59e0b' } }),
    prisma.tag.create({ data: { name: 'Work', color: '#3b82f6' } }),
    prisma.tag.create({ data: { name: 'Friend', color: '#10b981' } }),
    prisma.tag.create({ data: { name: 'Political', color: '#8b5cf6' } }),
  ])

  // Seed groups
  const groups = await Promise.all([
    prisma.group.create({
      data: { name: 'Inner Circle', description: 'Closest relationships' },
    }),
    prisma.group.create({
      data: {
        name: 'Professional Network',
        description: 'Work contacts and colleagues',
      },
    }),
    prisma.group.create({
      data: { name: 'Community', description: 'Local community members' },
    }),
  ])

  // Seed regions
  const regions = await Promise.all([
    prisma.region.create({ data: { name: 'Cape Breton' } }),
    prisma.region.create({ data: { name: 'North Shore' } }),
    prisma.region.create({ data: { name: 'South Shore' } }),
    prisma.region.create({ data: { name: 'Valley' } }),
    prisma.region.create({ data: { name: 'HRM' } }),
  ])

  // Seed contacts
  const now = new Date()
  const contacts = await Promise.all([
    prisma.contact.create({
      data: {
        firstName: 'Sarah',
        lastName: 'Mitchell',
        phone: '+1-902-555-0101',
        email: 'sarah.mitchell@example.com',
        organization: 'Mitchell & Associates',
        title: 'Managing Partner',
        location: 'Halifax, NS',
        linkedinUrl: 'https://linkedin.com/in/sarahmitchell',
        website: 'https://mitchellassociates.ca',
        notes: 'Met at the Halifax Chamber event. Very well connected.',
        lastContactedAt: daysAgo(3),
      },
    }),
    prisma.contact.create({
      data: {
        firstName: 'James',
        lastName: 'Chen',
        phone: '+1-902-555-0102',
        email: 'james.chen@techstart.io',
        organization: 'TechStart Atlantic',
        title: 'CEO',
        location: 'Dartmouth, NS',
        linkedinUrl: 'https://linkedin.com/in/jameschen',
        twitterUrl: 'https://twitter.com/jameschen',
        notes: 'Interested in civic tech. Runs the Atlantic startup incubator.',
        lastContactedAt: daysAgo(15),
      },
    }),
    prisma.contact.create({
      data: {
        firstName: 'Margaret',
        lastName: 'O\'Brien',
        phone: '+1-902-555-0103',
        email: 'margaret.obrien@gmail.com',
        organization: 'Retired',
        title: 'Community Volunteer',
        location: 'New Glasgow, NS',
        notes:
          'Active in local church and community garden. Knows everyone in Pictou County.',
        lastContactedAt: daysAgo(45),
      },
    }),
    prisma.contact.create({
      data: {
        firstName: 'David',
        lastName: 'Park',
        phone: '+1-902-555-0104',
        email: 'david.park@dal.ca',
        organization: 'Dalhousie University',
        title: 'Professor of Political Science',
        location: 'Halifax, NS',
        linkedinUrl: 'https://linkedin.com/in/davidpark',
        lastContactedAt: daysAgo(8),
      },
    }),
    prisma.contact.create({
      data: {
        firstName: 'Emily',
        lastName: 'Thompson',
        phone: '+1-902-555-0105',
        email: 'emily.thompson@cbc.ca',
        organization: 'CBC Nova Scotia',
        title: 'Senior Reporter',
        location: 'Halifax, NS',
        twitterUrl: 'https://twitter.com/emilythompson',
        notes: 'Covers provincial politics. Good for background conversations.',
        lastContactedAt: daysAgo(22),
      },
    }),
    prisma.contact.create({
      data: {
        firstName: 'Michael',
        lastName: 'Fraser',
        phone: '+1-902-555-0106',
        email: 'michael.fraser@nsgov.ca',
        organization: 'Province of Nova Scotia',
        title: 'Deputy Minister',
        location: 'Halifax, NS',
        lastContactedAt: daysAgo(60),
      },
    }),
    prisma.contact.create({
      data: {
        firstName: 'Lisa',
        lastName: 'MacDonald',
        email: 'lisa.macdonald@gmail.com',
        location: 'Antigonish, NS',
        notes: 'Old university friend. Catch up over coffee when in town.',
        lastContactedAt: null,
      },
    }),
    prisma.contact.create({
      data: {
        firstName: 'Robert',
        lastName: 'Singh',
        phone: '+1-416-555-0108',
        email: 'robert.singh@lawfirm.ca',
        organization: 'Singh Legal',
        title: 'Senior Counsel',
        location: 'Toronto, ON',
        linkedinUrl: 'https://linkedin.com/in/robertsingh',
        website: 'https://singhlegal.ca',
        lastContactedAt: null,
      },
    }),
    prisma.contact.create({
      data: {
        firstName: 'Anne',
        lastName: 'Leblanc',
        phone: '+1-506-555-0109',
        email: 'anne.leblanc@nb.ca',
        organization: 'Province of New Brunswick',
        title: 'Policy Analyst',
        location: 'Fredericton, NB',
        notes: 'Cross-provincial cooperation contact.',
        lastContactedAt: daysAgo(35),
      },
    }),
    prisma.contact.create({
      data: {
        firstName: 'Tom',
        lastName: 'Williams',
        phone: '+1-902-555-0110',
        email: 'tom.williams@rotary.org',
        organization: 'Rotary Club of Halifax',
        title: 'President',
        location: 'Halifax, NS',
        lastContactedAt: daysAgo(12),
      },
    }),
  ])

  // Assign tags to contacts
  const tagAssignments = [
    { contactIdx: 0, tagIdxs: [0, 2] }, // Sarah: VIP, Work
    { contactIdx: 1, tagIdxs: [2] }, // James: Work
    { contactIdx: 2, tagIdxs: [3, 4] }, // Margaret: Friend, Political
    { contactIdx: 3, tagIdxs: [2, 4] }, // David: Work, Political
    { contactIdx: 4, tagIdxs: [2] }, // Emily: Work
    { contactIdx: 5, tagIdxs: [0, 2, 4] }, // Michael: VIP, Work, Political
    { contactIdx: 6, tagIdxs: [3] }, // Lisa: Friend
    { contactIdx: 7, tagIdxs: [2] }, // Robert: Work
    { contactIdx: 8, tagIdxs: [2, 4] }, // Anne: Work, Political
    { contactIdx: 9, tagIdxs: [3] }, // Tom: Friend
  ]

  for (const { contactIdx, tagIdxs } of tagAssignments) {
    for (const tagIdx of tagIdxs) {
      await prisma.contactTag.create({
        data: {
          contactId: contacts[contactIdx].id,
          tagId: tags[tagIdx].id,
        },
      })
    }
  }

  // Assign contacts to groups
  const groupAssignments = [
    { contactIdx: 0, groupIdx: 0 }, // Sarah: Inner Circle
    { contactIdx: 0, groupIdx: 1 }, // Sarah: Professional
    { contactIdx: 1, groupIdx: 1 }, // James: Professional
    { contactIdx: 2, groupIdx: 2 }, // Margaret: Community
    { contactIdx: 3, groupIdx: 1 }, // David: Professional
    { contactIdx: 4, groupIdx: 1 }, // Emily: Professional
    { contactIdx: 5, groupIdx: 0 }, // Michael: Inner Circle
    { contactIdx: 5, groupIdx: 1 }, // Michael: Professional
    { contactIdx: 6, groupIdx: 0 }, // Lisa: Inner Circle
    { contactIdx: 9, groupIdx: 2 }, // Tom: Community
  ]

  for (const { contactIdx, groupIdx } of groupAssignments) {
    await prisma.contactGroup.create({
      data: {
        contactId: contacts[contactIdx].id,
        groupId: groups[groupIdx].id,
      },
    })
  }

  // Seed interactions (30+ across contacts)
  const interactions: Array<{
    contactIdx: number
    type: InteractionType
    content: string
    durationSeconds?: number
    daysAgoVal: number
    source?: string
  }> = [
    // Sarah - recently active
    {
      contactIdx: 0,
      type: 'MEETING',
      content: 'Lunch at The Bicycle Thief. Discussed community project funding.',
      durationSeconds: 3600,
      daysAgoVal: 3,
    },
    {
      contactIdx: 0,
      type: 'EMAIL_OUTBOUND',
      content: 'Sent follow-up on project proposal.',
      daysAgoVal: 5,
    },
    {
      contactIdx: 0,
      type: 'CALL_INBOUND',
      content: 'Called about Chamber event next month.',
      durationSeconds: 480,
      daysAgoVal: 10,
    },
    {
      contactIdx: 0,
      type: 'TEXT_OUTBOUND',
      content: 'Happy New Year!',
      daysAgoVal: 28,
    },
    // James - moderate activity
    {
      contactIdx: 1,
      type: 'CALL_OUTBOUND',
      content: 'Discussed civic tech initiative progress.',
      durationSeconds: 1200,
      daysAgoVal: 15,
    },
    {
      contactIdx: 1,
      type: 'EMAIL_INBOUND',
      content: 'Forwarded article about Atlantic startup ecosystem.',
      daysAgoVal: 20,
    },
    {
      contactIdx: 1,
      type: 'MEETING',
      content: 'Coffee at Anchored. Brainstormed hackathon ideas.',
      durationSeconds: 2700,
      daysAgoVal: 30,
    },
    // Margaret - needs attention (45 days ago)
    {
      contactIdx: 2,
      type: 'CALL_OUTBOUND',
      content: 'Caught up about community garden expansion.',
      durationSeconds: 900,
      daysAgoVal: 45,
    },
    {
      contactIdx: 2,
      type: 'NOTE',
      content: 'Reminder: she mentioned her granddaughter\'s graduation in June.',
      daysAgoVal: 50,
    },
    // David - fairly recent
    {
      contactIdx: 3,
      type: 'EMAIL_OUTBOUND',
      content: 'Asked for his opinion on the new policy brief.',
      daysAgoVal: 8,
    },
    {
      contactIdx: 3,
      type: 'MEETING',
      content: 'Panel discussion at Dalhousie. Good exchange of ideas.',
      durationSeconds: 5400,
      daysAgoVal: 25,
    },
    {
      contactIdx: 3,
      type: 'TEXT_INBOUND',
      content: 'Sent link to new research paper.',
      daysAgoVal: 35,
    },
    // Emily - moderate
    {
      contactIdx: 4,
      type: 'CALL_OUTBOUND',
      content: 'Background conversation about healthcare spending.',
      durationSeconds: 1800,
      daysAgoVal: 22,
    },
    {
      contactIdx: 4,
      type: 'TEXT_OUTBOUND',
      content: 'Thanks for the fair coverage on the infrastructure announcement.',
      daysAgoVal: 40,
    },
    {
      contactIdx: 4,
      type: 'EMAIL_INBOUND',
      content: 'Request for comment on education policy.',
      daysAgoVal: 55,
    },
    // Michael - needs attention (60 days)
    {
      contactIdx: 5,
      type: 'MEETING',
      content: 'Briefing on departmental priorities.',
      durationSeconds: 2400,
      daysAgoVal: 60,
    },
    {
      contactIdx: 5,
      type: 'CALL_OUTBOUND',
      content: 'Quick check-in about budget timeline.',
      durationSeconds: 300,
      daysAgoVal: 75,
    },
    {
      contactIdx: 5,
      type: 'EMAIL_OUTBOUND',
      content: 'Sent briefing notes for upcoming committee meeting.',
      daysAgoVal: 80,
    },
    // Anne - slightly stale
    {
      contactIdx: 8,
      type: 'CALL_OUTBOUND',
      content: 'Discussed cross-provincial healthcare agreement.',
      durationSeconds: 1500,
      daysAgoVal: 35,
    },
    {
      contactIdx: 8,
      type: 'EMAIL_OUTBOUND',
      content: 'Shared draft of interprovincial MOU.',
      daysAgoVal: 50,
    },
    // Tom - recent
    {
      contactIdx: 9,
      type: 'MEETING',
      content: 'Rotary Club monthly meeting.',
      durationSeconds: 7200,
      daysAgoVal: 12,
    },
    {
      contactIdx: 9,
      type: 'CALL_INBOUND',
      content: 'Invited to upcoming charity gala.',
      durationSeconds: 300,
      daysAgoVal: 18,
    },
    {
      contactIdx: 9,
      type: 'TEXT_OUTBOUND',
      content: 'Confirmed attendance for the fundraiser.',
      daysAgoVal: 19,
    },
    // More interactions for variety
    {
      contactIdx: 0,
      type: 'MAIL_SENT',
      content: 'Sent thank you card for referral.',
      daysAgoVal: 40,
    },
    {
      contactIdx: 1,
      type: 'NOTE',
      content: 'James mentioned he\'s looking to expand to PEI.',
      daysAgoVal: 32,
    },
    {
      contactIdx: 3,
      type: 'CALL_MISSED',
      content: 'Missed call, left voicemail.',
      daysAgoVal: 12,
    },
    {
      contactIdx: 4,
      type: 'MAIL_RECEIVED',
      content: 'Received invitation to media awards dinner.',
      daysAgoVal: 60,
    },
    {
      contactIdx: 5,
      type: 'NOTE',
      content: 'Michael retiring next year. Plan farewell.',
      daysAgoVal: 65,
    },
    {
      contactIdx: 2,
      type: 'MAIL_RECEIVED',
      content: 'Received Christmas card with family photo.',
      daysAgoVal: 33,
    },
    {
      contactIdx: 9,
      type: 'OTHER',
      content: 'Ran into Tom at the grocery store. Quick chat about upcoming events.',
      daysAgoVal: 5,
    },
    {
      contactIdx: 1,
      type: 'TEXT_OUTBOUND',
      content: 'Sent congrats on the funding announcement.',
      daysAgoVal: 16,
    },
    {
      contactIdx: 0,
      type: 'CALL_OUTBOUND',
      content: 'Discussed new office space options downtown.',
      durationSeconds: 600,
      daysAgoVal: 15,
    },
  ]

  for (const interaction of interactions) {
    await prisma.interaction.create({
      data: {
        contactId: contacts[interaction.contactIdx].id,
        type: interaction.type,
        content: interaction.content,
        durationSeconds: interaction.durationSeconds ?? null,
        occurredAt: daysAgo(interaction.daysAgoVal),
        source: 'MANUAL',
      },
    })
  }

  // Seed reminders
  const reminders = [
    {
      contactIdx: 2,
      daysFromNow: 3,
      note: 'Call Margaret to check on community garden project.',
      completed: false,
    },
    {
      contactIdx: 5,
      daysFromNow: 7,
      note: 'Schedule lunch with Michael before budget season.',
      completed: false,
    },
    {
      contactIdx: 1,
      daysFromNow: 14,
      note: 'Follow up with James about hackathon planning.',
      completed: false,
    },
    {
      contactIdx: 4,
      daysFromNow: -5,
      note: 'Send Emily the updated stats she requested.',
      completed: false,
    },
    {
      contactIdx: 0,
      daysFromNow: -10,
      note: 'Review Sarah\'s project proposal draft.',
      completed: true,
    },
    {
      contactIdx: 8,
      daysFromNow: 5,
      note: 'Follow up on interprovincial MOU feedback.',
      completed: false,
    },
  ]

  for (const reminder of reminders) {
    await prisma.reminder.create({
      data: {
        contactId: contacts[reminder.contactIdx].id,
        remindAt: daysFromNow(reminder.daysFromNow),
        note: reminder.note,
        completed: reminder.completed,
      },
    })
  }

  // Seed notable dates
  // Ensure at least one birthday is within 7 days from now
  const upcomingBirthdayDate = new Date()
  upcomingBirthdayDate.setDate(upcomingBirthdayDate.getDate() + 4)

  const notableDates = [
    {
      contactIdx: 0,
      type: 'BIRTHDAY' as const,
      label: null,
      month: 6,
      day: 15,
      year: 1985,
      recurring: true,
      notes: null,
    },
    {
      contactIdx: 1,
      type: 'BIRTHDAY' as const,
      label: null,
      month: upcomingBirthdayDate.getMonth() + 1,
      day: upcomingBirthdayDate.getDate(),
      year: 1990,
      recurring: true,
      notes: 'Likes craft beer.',
    },
    {
      contactIdx: 2,
      type: 'BIRTHDAY' as const,
      label: null,
      month: 3,
      day: 22,
      year: null,
      recurring: true,
      notes: 'Not sure of the year.',
    },
    {
      contactIdx: 3,
      type: 'ANNIVERSARY' as const,
      label: 'Wedding anniversary',
      month: 9,
      day: 10,
      year: 2010,
      recurring: true,
      notes: null,
    },
    {
      contactIdx: 4,
      type: 'FIRST_MET' as const,
      label: null,
      month: 11,
      day: 5,
      year: 2022,
      recurring: false,
      notes: 'Met at the press gallery reception.',
    },
    {
      contactIdx: 5,
      type: 'CUSTOM' as const,
      label: 'Retirement date',
      month: 6,
      day: 30,
      year: 2027,
      recurring: false,
      notes: 'Planning to retire at end of fiscal year.',
    },
    {
      contactIdx: 6,
      type: 'BIRTHDAY' as const,
      label: null,
      month: 8,
      day: 18,
      year: 1988,
      recurring: true,
      notes: null,
    },
    {
      contactIdx: 9,
      type: 'ELECTION' as const,
      label: 'Rotary Club elections',
      month: 4,
      day: 15,
      year: null,
      recurring: true,
      notes: 'Annual board election.',
    },
    {
      contactIdx: 8,
      type: 'CUSTOM' as const,
      label: 'MOU renewal deadline',
      month: 12,
      day: 31,
      year: 2026,
      recurring: false,
      notes: 'Interprovincial agreement expires.',
    },
  ]

  for (const nd of notableDates) {
    await prisma.notableDate.create({
      data: {
        contactId: contacts[nd.contactIdx].id,
        type: nd.type,
        label: nd.label,
        month: nd.month,
        day: nd.day,
        year: nd.year,
        recurring: nd.recurring,
        notes: nd.notes,
      },
    })
  }

  console.log('Seed complete!')
  console.log(`  ${contacts.length} contacts`)
  console.log(`  ${tags.length} tags`)
  console.log(`  ${groups.length} groups`)
  console.log(`  ${interactions.length} interactions`)
  console.log(`  ${reminders.length} reminders`)
  console.log(`  ${notableDates.length} notable dates`)
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function daysFromNow(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
