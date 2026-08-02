/**
 * Icone della barra in basso, disegnate a mano.
 *
 * Le emoji di sistema sono fuori controllo: cambiano forma fra iOS, Android e
 * desktop, hanno colori loro che litigano con la palette, e non si possono
 * riempire quando la scheda è attiva. Qui invece: tratto spesso arrotondato
 * come i bottoni, e passando da inattiva ad attiva la forma si riempie di
 * colore — lo stesso schema di Duolingo.
 *
 * Tutto in currentColor, così il colore lo decide il CSS della scheda.
 */

interface IconProps {
  active?: boolean
}

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

/** Riempimento tenue della sagoma quando la scheda è attiva. */
const tint = (active?: boolean) => (active ? 'var(--tab-tint)' : 'none')
/** Dettagli interni: pieni da attiva, vuoti da inattiva. */
const solid = (active?: boolean) => (active ? 'currentColor' : 'none')

/** Oggi: la cornice del selfie con una faccia dentro. */
export function IconToday({ active }: IconProps) {
  return (
    <svg {...base}>
      <rect x="4" y="3" width="16" height="18" rx="3.6" fill={tint(active)} />
      <circle cx="9.6" cy="10" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="14.4" cy="10" r="1.15" fill="currentColor" stroke="none" />
      <path d="M9.6 14.4c1.2 1.4 3.6 1.4 4.8 0" strokeWidth="1.9" />
    </svg>
  )
}

/** Calendario: griglia con i giorni fatti. */
export function IconCalendar({ active }: IconProps) {
  return (
    <svg {...base}>
      <rect x="3" y="5" width="18" height="16" rx="3.2" fill={tint(active)} />
      <path d="M8 3v3.4M16 3v3.4M3.4 10h17.2" />
      <circle cx="8.2" cy="14" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="14" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.8" cy="14" r="1.1" fill={solid(active)} strokeWidth="1.4" />
      <circle cx="8.2" cy="17.6" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="17.6" r="1.1" fill={solid(active)} strokeWidth="1.4" />
    </svg>
  )
}

/** Video: pellicola con il play. */
export function IconVideo({ active }: IconProps) {
  return (
    <svg {...base}>
      <rect x="2.6" y="5" width="18.8" height="14" rx="3.2" fill={tint(active)} />
      <path d="M7 5v14M17 5v14" strokeWidth="1.6" />
      <path d="M10.6 9.4 14.6 12l-4 2.6z" fill="currentColor" strokeWidth="1.6" />
    </svg>
  )
}

/** Traguardi: medaglia con la stella. */
export function IconBadges({ active }: IconProps) {
  return (
    <svg {...base}>
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
