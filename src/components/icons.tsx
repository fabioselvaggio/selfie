/**
 * Tutte le icone dell'interfaccia, disegnate a mano.
 *
 * Niente emoji da nessuna parte: le disegna il sistema operativo, quindi
 * cambiano forma fra iOS, Android e desktop, si portano dietro colori loro che
 * litigano con la palette, e non si possono riempire o colorare in base allo
 * stato.
 *
 * Regole comuni: griglia 24×24, tratto 2 con estremità arrotondate, tutto in
 * currentColor. La dimensione e il colore li decide il CSS di chi le usa.
 */

import type { SVGProps } from 'react'

type Props = SVGProps<SVGSVGElement> & { active?: boolean }

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

/** Riempimento tenue della sagoma quando l'elemento è attivo. */
const tint = (active?: boolean) => (active ? 'var(--tab-tint)' : 'none')

// ------------------------------------------------------------------ barra tab

/** Oggi: la cornice del selfie con una faccia dentro. */
export function IconToday({ active, ...rest }: Props) {
  return (
    <svg {...base} {...rest}>
      <rect x="4" y="3" width="16" height="18" rx="3.6" fill={tint(active)} />
      <circle cx="9.6" cy="10" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="14.4" cy="10" r="1.15" fill="currentColor" stroke="none" />
      <path d="M9.6 14.4c1.2 1.4 3.6 1.4 4.8 0" strokeWidth="1.9" />
    </svg>
  )
}

/** Calendario: griglia con i giorni fatti. */
export function IconCalendar({ active, ...rest }: Props) {
  return (
    <svg {...base} {...rest}>
      <rect x="3" y="5" width="18" height="16" rx="3.2" fill={tint(active)} />
      <path d="M8 3v3.4M16 3v3.4M3.4 10h17.2" />
      <circle cx="8.2" cy="14" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.8" cy="14" r="1.1" fill={active ? 'currentColor' : 'none'} strokeWidth="1.4" />
      <circle cx="8.2" cy="17.6" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="17.6" r="1.1" fill={active ? 'currentColor' : 'none'} strokeWidth="1.4" />
    </svg>
  )
}

/** Video: pellicola con la testina di play. */
export function IconVideo({ active, ...rest }: Props) {
  return (
    <svg {...base} {...rest}>
      <rect x="2.6" y="5" width="18.8" height="14" rx="3.2" fill={tint(active)} />
      <path d="M7 5v14M17 5v14" strokeWidth="1.6" />
      <path d="M10.6 9.4 14.6 12l-4 2.6z" fill="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

/** Traguardi: medaglia con la stella. */
export function IconBadges({ active, ...rest }: Props) {
  return (
    <svg {...base} {...rest}>
      <path d="M8.4 14.6 6.9 21l5.1-2.3 5.1 2.3-1.5-6.4" fill={tint(active)} />
      <circle cx="12" cy="9.2" r="6.2" fill={tint(active)} />
      <path
        d="M12 6 12.85 8.03 15.04 8.21 13.38 9.65 13.88 11.79 12 10.65 10.12 11.79 10.62 9.65 8.96 8.21 11.15 8.03Z"
        fill={active ? 'currentColor' : 'none'}
        strokeWidth="1.5"
      />
    </svg>
  )
}

// ------------------------------------------------------------------ comandi

/** Chiusura dei pannelli. */
export function IconClose(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" strokeWidth="2.2" />
    </svg>
  )
}

/**
 * Impostazioni: cursori, non un ingranaggio.
 * A 22px i denti di un ingranaggio diventano una macchia; tre cursori con la
 * manopola restano leggibili e dicono la stessa cosa.
 */
export function IconSettings(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 7h8M16.5 7H20M4 12h3.5M12 12h8M4 17h9.5M18 17h2" />
      <circle cx="14.2" cy="7" r="2.3" />
      <circle cx="9.7" cy="12" r="2.3" />
      <circle cx="15.7" cy="17" r="2.3" />
    </svg>
  )
}

export function IconTimer(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 9.5v4l2.6 1.8M9.5 2.5h5M18.6 6.4l1.4-1.4" />
    </svg>
  )
}

export function IconRetry(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M20 12a8 8 0 1 1-2.4-5.7" />
      <path d="M20.5 3.5V8h-4.5" />
    </svg>
  )
}

export function IconTrash(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 6.6h15M9.4 6.6V4.4h5.2v2.2M6.8 6.6l.9 13h8.6l.9-13M10.4 10.2v6M13.6 10.2v6" />
    </svg>
  )
}

export function IconGallery(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="4.5" width="18" height="15" rx="3.2" />
      <circle cx="15.6" cy="9.2" r="1.7" />
      <path d="M3.4 15.6 8 11.2l3.2 3 2.4-2 6.9 6.2" />
    </svg>
  )
}

/** Spunta nuda, senza cerchio: per le selezioni dentro altri elementi. */
export function IconTick(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="m5.5 12.8 4.4 4.4L18.8 6.8" strokeWidth="2.8" />
    </svg>
  )
}

export function IconCheck(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m7.8 12.3 2.9 2.9 5.5-6" strokeWidth="2.2" />
    </svg>
  )
}

export function IconPlay(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M8.5 5.6 19 12 8.5 18.4z" fill="currentColor" strokeWidth="2.4" />
    </svg>
  )
}

export function IconPause(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M9.2 5.5v13M14.8 5.5v13" strokeWidth="3.2" />
    </svg>
  )
}

export function IconExport(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5v11M7.8 10.6 12 14.8l4.2-4.2M4.5 19.5h15" />
    </svg>
  )
}

export function IconLock(props: Props) {
  return (
    <svg {...base} {...props}>
      <rect x="4.8" y="10.4" width="14.4" height="10.2" rx="2.8" />
      <path d="M8.4 10.4V7.8a3.6 3.6 0 0 1 7.2 0v2.6" />
    </svg>
  )
}

export function IconChevronLeft(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M14.8 5.4 8.2 12l6.6 6.6" strokeWidth="2.4" />
    </svg>
  )
}

export function IconChevronRight(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M9.2 5.4 15.8 12l-6.6 6.6" strokeWidth="2.4" />
    </svg>
  )
}

/** Icona dell'app, usata nell'anteprima della notifica. */
export function IconCamera(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M3 8.6a2.6 2.6 0 0 1 2.6-2.6h1.8l1.3-2.2h6.6L16.6 6h1.8A2.6 2.6 0 0 1 21 8.6v9A2.6 2.6 0 0 1 18.4 20H5.6A2.6 2.6 0 0 1 3 17.6z" />
      <circle cx="12" cy="12.8" r="3.6" />
    </svg>
  )
}

/** Streak interrotto: sole dietro una nuvola. Tono gentile, non punitivo. */
export function IconCloudySun(props: Props) {
  return (
    <svg {...base} {...props}>
      <circle cx="8.6" cy="7.6" r="3" />
      <path d="M8.6 1.6v1.4M8.6 12.2v1.2M2.6 7.6H4M13.2 7.6h1.4M4.3 3.3l1 1M12.9 3.3l-1 1" strokeWidth="1.6" />
      <path d="M9.4 20.5h8.4a3.6 3.6 0 0 0 .3-7.2 4.8 4.8 0 0 0-9.1.9 3.2 3.2 0 0 0 .4 6.3z" fill="var(--card)" />
    </svg>
  )
}

// ------------------------------------------------------------------ streak

/**
 * Fiamma dello streak.
 *
 * Da accesa è piena e SENZA contorno: con `stroke-linejoin: round` e un tratto
 * da 2 la punta si arrotonda e la fiamma diventa una goccia. Il profilo pulito
 * è l'unica cosa che la rende leggibile a 20px.
 */
export function IconFlame({ active = true, ...rest }: Props) {
  const flame =
    'M12.6 1.6c-.5 2.7-2 4.3-3.6 5.8C7 9.2 5.2 11 5.2 14.1a6.8 6.8 0 0 0 13.6 0c0-2.3-1-4-2.2-5.6-.5 1-1.2 1.7-2 2 .7-3.3.2-6.3-2-8.9z'
  const core = 'M12.2 12.4c1.5 1.5 2.3 2.6 2.3 3.9a2.4 2.4 0 0 1-4.8 0c0-1.3.9-2.4 2.5-3.9z'
  return (
    <svg {...base} {...rest}>
      {active ? (
        <>
          <path d={flame} fill="currentColor" stroke="none" />
          <path d={core} fill="var(--flame-core)" stroke="none" />
        </>
      ) : (
        <>
          <path d={flame} fill="none" strokeWidth="1.9" />
          <path d={core} fill="none" strokeWidth="1.6" />
        </>
      )}
    </svg>
  )
}

// ------------------------------------------------------------------ traguardi

export type BadgeIconName =
  | 'sprout'
  | 'flame'
  | 'bolt'
  | 'moon'
  | 'peak'
  | 'gem'
  | 'crown'
  | 'trophy'

function IconSprout(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 21v-6.6" />
      <path d="M12 14.4c0-3.1-2.3-5.2-5.4-5.2 0 3.1 2.3 5.2 5.4 5.2z" fill="currentColor" fillOpacity="0.18" />
      <path d="M12 14.4c0-2.8 2-4.7 4.8-4.7 0 2.8-2 4.7-4.8 4.7z" fill="currentColor" fillOpacity="0.18" />
      <path d="M9.6 21h4.8" />
    </svg>
  )
}

function IconBolt(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M13.6 2.5 6.4 13.2h4.6L9.9 21.5l7.7-11.2h-4.8z" fill="currentColor" fillOpacity="0.18" />
    </svg>
  )
}

function IconMoon(props: Props) {
  return (
    <svg {...base} {...props}>
      <path
        d="M20.4 14.6A8.6 8.6 0 0 1 9.4 3.6a8.6 8.6 0 1 0 11 11z"
        fill="currentColor"
        fillOpacity="0.18"
      />
    </svg>
  )
}

function IconPeak(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M2.6 19.4 9 8.2l3.9 6.2 2.3-3.4 6.2 8.4z" fill="currentColor" fillOpacity="0.18" />
      <path d="M9 8.2 6.4 12.8h5.2z" fill="currentColor" />
    </svg>
  )
}

function IconGem(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M6.4 3.6h11.2l3.4 5.6L12 20.6 1 9.2z" fill="currentColor" fillOpacity="0.18" />
      <path d="M1 9.2h22M6.4 3.6 9 9.2l3 11.4L15 9.2l2.6-5.6" strokeWidth="1.5" />
    </svg>
  )
}

function IconCrown(props: Props) {
  return (
    <svg {...base} {...props}>
      <path
        d="M3.4 7.6 7 12l5-6.4 5 6.4 3.6-4.4L19 19H5z"
        fill="currentColor"
        fillOpacity="0.18"
      />
      <path d="M5 19h14" />
    </svg>
  )
}

export function IconTrophy(props: Props) {
  return (
    <svg {...base} {...props}>
      <path d="M7 3.6h10V9a5 5 0 0 1-10 0z" fill="currentColor" fillOpacity="0.18" />
      <path d="M7 5.4H4.4v1.4A3.4 3.4 0 0 0 7.9 10M17 5.4h2.6v1.4A3.4 3.4 0 0 1 16.1 10" />
      <path d="M12 14v3.4M8.4 20.4h7.2" />
    </svg>
  )
}

const BADGE_ICONS: Record<BadgeIconName, (p: Props) => JSX.Element> = {
  sprout: IconSprout,
  flame: (p) => <IconFlame {...p} active={false} />,
  bolt: IconBolt,
  moon: IconMoon,
  peak: IconPeak,
  gem: IconGem,
  crown: IconCrown,
  trophy: IconTrophy,
}

export function BadgeIcon({ name, ...rest }: Props & { name: BadgeIconName }) {
  const Cmp = BADGE_ICONS[name]
  return <Cmp {...rest} />
}
