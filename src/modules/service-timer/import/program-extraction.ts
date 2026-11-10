import { z } from 'zod/v4';

/**
 * What Claude returns for an uploaded order of service. Every field is
 * required so the structured output is complete; "not stated" is an empty
 * string, and guesses are flagged with `confident: false` so the review
 * screen can highlight them.
 */
export const ProgramSchema = z.object({
  readable: z
    .boolean()
    .describe(
      'false if this is not an order of service or programme, or is too unclear to read',
    ),
  serviceName: z
    .string()
    .describe(
      'The service name if the document gives one, e.g. "Sunday Worship Service"; otherwise ""',
    ),
  serviceStart: z
    .string()
    .describe(
      'When the service starts, as 24-hour HH:MM (e.g. "09:00"), if stated or shown by the first item; otherwise ""',
    ),
  items: z
    .array(
      z.object({
        name: z
          .string()
          .describe(
            'The item as written, kept short: no times, numbering or bullets',
          ),
        person: z
          .string()
          .describe(
            'Who leads or is responsible for the item, with any title (e.g. "Pst. Oluwatoyin", "Choir"); "" if no one is named',
          ),
        minutes: z.number().describe('Planned length in whole minutes'),
        confident: z
          .boolean()
          .describe(
            'false if the minutes or person had to be estimated or were hard to read',
          ),
      }),
    )
    .describe('The program items in the order they happen'),
});

export type ExtractedProgram = z.infer<typeof ProgramSchema>;

export const EXTRACTION_SYSTEM = `You read church orders of service (programmes) and turn them into the list of items for a service countdown timer. Churches upload PDFs, Word documents and phone photos of printed or handwritten programmes.

For each item in the service, in order:
- name: the item as the church wrote it (e.g. "Praise & Worship", "The Word", "Tithes & Offering"), without times, numbering or bullet characters.
- person: whoever is named as leading it, with their title as written; leave empty if no one is named.
- minutes: the planned length. Use a stated duration if there is one. If the programme gives start times instead, use the gap until the next item's start time. If it gives a time range, use the range. If nothing says how long it takes, give a realistic estimate for that kind of item in a church service and mark it as not confident.
- confident: false whenever you estimated the minutes, or a name or time was hard to read.

Also give the service name and start time when the programme shows them. Leave out headings, announcements of the date, scripture text and anything that is not a timed part of the service. If the upload is not an order of service, set readable to false and return no items.`;

export const EXTRACTION_INSTRUCTION =
  'Extract the order of service from this upload.';

export interface TidyProgram {
  serviceName: string;
  serviceStart: string;
  items: {
    name: string;
    person: string;
    minutes: number;
    confident: boolean;
  }[];
}

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;
export const MAX_IMPORT_ITEMS = 100;

/**
 * Makes the model's answer safe to show and save: trimmed text within the
 * template limits, whole minutes between 0 and 600, a valid HH:MM start, and
 * no empty items. Anything uncertain stays flagged for the review screen.
 */
export function tidyProgram(p: ExtractedProgram): TidyProgram {
  const start = HHMM.exec(p.serviceStart.trim());
  const items = p.items
    .map((it) => {
      const raw = Number(it.minutes);
      const minutes = Number.isFinite(raw)
        ? Math.min(600, Math.max(0, Math.round(raw)))
        : 0;
      return {
        name: it.name.replace(/\s+/g, ' ').trim().slice(0, 120),
        person: it.person.replace(/\s+/g, ' ').trim().slice(0, 80),
        minutes,
        confident: it.confident && minutes > 0,
      };
    })
    .filter((it) => it.name.length > 0)
    .slice(0, MAX_IMPORT_ITEMS);
  return {
    serviceName: p.serviceName.replace(/\s+/g, ' ').trim().slice(0, 60),
    serviceStart: start ? `${start[1].padStart(2, '0')}:${start[2]}` : '',
    items,
  };
}

/** The first day of the next month (UTC), when the monthly allowance resets. */
export function monthBounds(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  return { start, next };
}
