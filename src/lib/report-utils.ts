/**
 * Shared utilities for report deduplication and deletable detection.
 *
 * Naming conventions vary (drivers name things manually):
 *   2025: "...#5 Temp", "...#5 TEMP 1S", "...#5 Final"
 *   2026: "...#5_1pass", "...#5_2.8pass", "...#5_FINAL"
 *
 * We strip all known suffixes to get a "base title" for grouping,
 * but use the report_final flag as the authoritative signal for
 * whether a report is final.
 */

/** All known title suffixes (draft + final) stripped to extract base title */
const TITLE_SUFFIX_PATTERNS: RegExp[] = [
	// 2025 conventions
	/\s+Temp\s*$/i,
	/\s+Temp\s+\d+S?\s*$/i,
	/\s+Temp\d+\s*$/i,
	/\s+TEMP\s*$/i,
	/\s+TEMP\s+\d+S?\s*$/i,
	/Temp\s*TEMP\s*$/i,
	/\d*TEMP\s*$/i,
	/[A-Za-z]Temp\s*$/,
	/\s+Final\s*$/i,
	/\s+FINAL\s*$/i,
	// 2026+ conventions
	/_\d+\.?\d*pass\s*$/i,
	/_FINAL\s*$/i,
];

/** Extract the base title by stripping all known suffixes */
export function getBaseTitle(title: string): string {
	for (const p of TITLE_SUFFIX_PATTERNS) {
		if (p.test(title)) {
			return title.replace(p, '').trim();
		}
	}
	return title;
}

/** Check if a report is final by its report_final field */
export function isFinalReport(report: { report_final: unknown }): boolean {
	return (
		report.report_final === true ||
		report.report_final === 1 ||
		report.report_final === '1' ||
		report.report_final === 'true'
	);
}

/**
 * Deduplicate final reports by base title.
 * When multiple finals share the same base title, keeps only the newest one.
 * Non-final reports are not affected.
 *
 * @param reports - Array of report objects (must have report_title, report_date, report_final)
 * @returns A new array with duplicate finals removed
 */
export function deduplicateFinals<
	T extends { report_title: string; report_date: string; report_final: unknown }
>(reports: T[]): T[] {
	// Group finals by base title
	const finalsByBase = new Map<string, T[]>();
	for (const r of reports) {
		if (!isFinalReport(r)) continue;
		const base = getBaseTitle(r.report_title || '');
		if (!finalsByBase.has(base)) finalsByBase.set(base, []);
		finalsByBase.get(base)!.push(r);
	}

	// Build a set of IDs to exclude (older duplicate finals)
	const excludeSet = new Set<T>();
	for (const [, finals] of finalsByBase) {
		if (finals.length <= 1) continue;
		// Sort newest first
		finals.sort(
			(a, b) => new Date(b.report_date).getTime() - new Date(a.report_date).getTime()
		);
		// Exclude all but the newest
		for (let i = 1; i < finals.length; i++) {
			excludeSet.add(finals[i]);
		}
	}

	return reports.filter((r) => !excludeSet.has(r));
}

/**
 * Determine if a report is deletable, and why.
 *
 * Checks:
 *   1. Exact title duplicates with conflicting final/draft flags
 *   2. Non-final reports where a final version exists (same base title)
 *   3. Older non-final reports among drafts sharing the same base title
 *   4. Older duplicate final reports sharing the same base title
 */
export function isReportDeletable<
	T extends {
		id: string;
		report_title: string;
		report_date: string;
		report_final: unknown;
	}
>(report: T, allReports: T[]): { isDeletable: boolean; reason: string } {
	const title = report.report_title || '';
	const final = isFinalReport(report);
	const base = getBaseTitle(title);

	// 1. Exact title duplicates with conflicting final/draft flags
	const hasExactDuplicate = allReports.some(
		(o) =>
			o.id !== report.id &&
			(o.report_title || '') === title &&
			title.trim() !== '' &&
			isFinalReport(o) !== final
	);
	if (hasExactDuplicate) {
		return { isDeletable: true, reason: 'Duplicate title with conflicting status' };
	}

	if (!final) {
		// 2. Non-final with a final version existing
		const hasFinalVersion = allReports.some(
			(o) =>
				o.id !== report.id &&
				isFinalReport(o) &&
				getBaseTitle(o.report_title || '') === base
		);
		if (hasFinalVersion) {
			return { isDeletable: true, reason: 'Draft report — final version exists' };
		}

		// 3. Older draft among siblings
		const draftSiblings = allReports.filter(
			(r) => !isFinalReport(r) && getBaseTitle(r.report_title || '') === base
		);
		if (draftSiblings.length > 1) {
			draftSiblings.sort(
				(a, b) =>
					new Date(b.report_date).getTime() - new Date(a.report_date).getTime()
			);
			const idx = draftSiblings.findIndex((r) => r.id === report.id);
			if (idx > 0) {
				return {
					isDeletable: true,
					reason: `Older draft (${idx + 1} of ${draftSiblings.length})`,
				};
			}
		}
	} else {
		// 4. Duplicate finals — older ones are deletable
		const finalSiblings = allReports.filter(
			(r) => isFinalReport(r) && getBaseTitle(r.report_title || '') === base
		);
		if (finalSiblings.length > 1) {
			finalSiblings.sort(
				(a, b) =>
					new Date(b.report_date).getTime() - new Date(a.report_date).getTime()
			);
			const idx = finalSiblings.findIndex((r) => r.id === report.id);
			if (idx > 0) {
				return {
					isDeletable: true,
					reason: `Duplicate final (${idx + 1} of ${finalSiblings.length})`,
				};
			}
		}
	}

	return { isDeletable: false, reason: '' };
}
