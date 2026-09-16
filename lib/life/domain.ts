export const categories = ['Bills and subscriptions', 'Insurance and renewals', 'Vehicle registration and maintenance', 'Pet care and vaccinations', 'Appointments', 'Passports and identification', 'Warranties and receipts', 'Birthdays and important dates', 'Memberships', 'Home maintenance', 'Other responsibilities'] as const;
export type Item = {
    id: string;
    title: string;
    category: string;
    associated: string;
    provider: string;
    due: string;
    cost: string;
    currency: string;
    recurrence: string;
    interval: number;
    basis: string;
    anchor: string;
    reminders: number[];
    notes: string;
    checklist: {
        text: string;
        done: boolean;
    }[];
    status: string;
    cycle: number;
    version: number;
    snooze: string;
    created: string;
};
export const blankItem = (): Item => ({ id: '', title: '', category: categories[0], associated: '', provider: '', due: '', cost: '', currency: 'USD', recurrence: 'none', interval: 1, basis: 'calendar', anchor: '', reminders: [30, 7, 0], notes: '', checklist: [], status: 'active', cycle: 0, version: 0, snooze: '', created: '' });
export function validDate(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) && new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) === s; }
export function today(zone = 'UTC', now = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now); }
export function days(a: string, b: string) { return Math.round((Date.parse(a + 'T12:00:00Z') - Date.parse(b + 'T12:00:00Z')) / 86400000); }
export function shift(date: string, n: number) { const d = new Date(date + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function advance(date: string, unit: string, n: number, anchor = date) { if (unit === 'weekly' || unit === 'daily')
    return shift(date, n * (unit === 'weekly' ? 7 : 1)); const d = new Date(date + 'T12:00:00Z'), a = new Date(anchor + 'T12:00:00Z'); const m = d.getUTCMonth() + n * (unit === 'annual' ? 12 : 1); d.setUTCDate(1); d.setUTCMonth(m); const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); d.setUTCDate(Math.min(a.getUTCDate(), end)); return d.toISOString().slice(0, 10); }
export function nextDate(i: Item, completed: string) { if (i.recurrence === 'none' || !i.due)
    return ''; const base = i.basis === 'completion' ? completed : i.due; return advance(base, i.recurrence, i.interval, i.basis === 'completion' ? completed : i.anchor || i.due); }
export function status(i: Item, date: string) { if (i.status !== 'active')
    return i.status === 'completed' ? 'Completed' : 'Archived'; if (!i.due)
    return 'Needs a date'; const n = days(i.due, date); return n < 0 ? 'Overdue' : n <= 7 ? 'Due soon' : n <= Math.max(...i.reminders, 30) ? 'Preparation needed' : 'Upcoming'; }
export function dueLabel(i: Item, date: string) { if (!i.due)
    return 'Add a date when you know it'; const n = days(i.due, date); return n < 0 ? `${Math.abs(n)} ${Math.abs(n) === 1 ? 'day' : 'days'} overdue` : n === 0 ? 'Due today' : n === 1 ? 'Due tomorrow' : `Due in ${n} days`; }
export function guidance(category: string) { if (category.includes('Insurance'))
    return ['Find your current coverage and deductible', 'Check the renewal premium against your current price', 'Write down questions for your provider', 'Confirm the new expiration date after renewal']; if (category.includes('Pet'))
    return ['Check the most recent care or vaccination record', 'Confirm the next date with your veterinarian', 'Keep the updated record after the appointment']; if (category.includes('Vehicle'))
    return ['Check your vehicle records and provider instructions', 'Confirm the service or renewal date', 'Save the receipt and next recommended date']; return ['Review your records and confirm the deadline', 'Gather what you need before the due date', 'Complete the task and save your confirmation']; }
export const suggestionRules = [
    { id: 'registration', title: 'Vehicle registration renewal', category: categories[2], why: 'You said you have a vehicle.', flag: 'vehicle', match: 'registration' },
    { id: 'vehicle-insurance', title: 'Car insurance renewal', category: categories[1], why: 'You said you have a vehicle.', flag: 'vehicle', match: 'car insurance' },
    { id: 'pet-vaccines', title: 'Pet vaccination records', category: categories[3], why: 'You said you have pets.', flag: 'pets', match: 'vaccin' },
    { id: 'home-filter', title: 'HVAC filter check', category: categories[9], why: 'You said you own your home.', flag: 'own', match: 'filter' },
    { id: 'rent-renewal', title: 'Lease renewal', category: categories[10], why: 'You said you rent your home.', flag: 'rent', match: 'lease' },
    { id: 'family-dates', title: 'Family birthdays', category: categories[7], why: 'You manage responsibilities for family.', flag: 'family', match: 'birthday' },
    { id: 'insurance-review', title: 'Review insurance renewal price', category: categories[1], why: 'You have an insurance responsibility. Reviewing the price may help you prepare.', flag: 'insurance', match: 'review insurance' },
];
export function suggestions(profile: any, items: Item[], dismissals: any[], date: string) { const generic = categories.filter(c => profile.categories?.includes(c) && !items.some(i => i.category === c && i.status !== 'archived')).map((c, j) => ({ id: 'category-' + categories.indexOf(c), title: ['Review a bill or subscription', 'Insurance renewal', 'Vehicle maintenance', 'Pet care appointment', 'Upcoming appointment', 'Passport expiration', 'Warranty expiration', 'An important birthday', 'Membership renewal', 'Home maintenance task', 'An everyday responsibility'][categories.indexOf(c)], category: c, why: 'You chose this category during setup and have no active items in it.', flag: 'category', match: '__category__' })); return [...suggestionRules, ...generic].filter(r => { const relevant = r.flag === 'category' ? true : r.flag === 'own' || r.flag === 'rent' ? profile.home === r.flag : r.flag === 'insurance' ? items.some(i => i.category === categories[1] && i.status === 'active') : profile[r.flag] === true; return relevant && !items.some(i => i.status !== 'archived' && i.title.toLowerCase().includes(r.match)) && !dismissals.some(d => d.id === r.id && (d.until === 'forever' || d.until > date)); }).filter((r, j, all) => !all.slice(0, j).some(x => x.category === r.category && r.flag === 'category')); }
export function reminderStage(i: Item, date: string) { if (!i.due || i.status !== 'active' || i.snooze > date)
    return null; const reached = [...new Set(i.reminders)].filter(n => shift(i.due, -n) <= date).sort((a, b) => a - b); return reached.length ? reached[0] : null; }
export function quiet(hour: number, start: number, end: number) { return start === end ? false : start < end ? hour >= start && hour < end : hour >= start || hour < end; }
export function eligibleReminderDate(p: any, now: Date) { const date = today(p.timezone, now), hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: p.timezone, hour: '2-digit', hourCycle: 'h23' }).format(now)); if (quiet(hour, p.quietStart, p.quietEnd))
    return null; const deferred = quiet(p.reminderHour, p.quietStart, p.quietEnd); const targetHour = deferred ? p.quietEnd : p.reminderHour; if (hour < targetHour)
    return null; return deferred && p.quietStart > p.quietEnd && p.reminderHour >= p.quietStart ? shift(date, -1) : date; }
