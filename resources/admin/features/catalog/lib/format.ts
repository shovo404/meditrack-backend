/** Format an ISO-8601 timestamp as a short local date for table/card display. */
export function formatCatalogDate(iso: string | null | undefined): string {
    if (!iso) {
        return '—'
    }

    const date = new Date(iso)

    if (Number.isNaN(date.getTime())) {
        return '—'
    }

    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}

/** Show a readable stand-in for a nullable catalog field. */
export function orDash(value: string | null | undefined): string {
    return value?.trim() ? value : '—'
}