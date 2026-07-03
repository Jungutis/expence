import { expensesApi } from '../services/api';

export interface QueuedExpense {
  category: string;
  amount: number;
  note?: string;
  date: string; // YYYY-MM-DD — kada realiai išleista
  queuedAt: string;
}

const KEY = 'offline-expense-queue';

function read(): QueuedExpense[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

function write(items: QueuedExpense[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function queueLength(): number {
  return read().length;
}

/** Įdeda išlaidą į offline eilę (kai nėra ryšio) */
export function enqueueExpense(item: Omit<QueuedExpense, 'queuedAt'>) {
  const items = read();
  items.push({ ...item, queuedAt: new Date().toISOString() });
  write(items);
}

/** Ar klaida panaši į tinklo klaidą (nėra atsakymo iš serverio) */
export function isNetworkError(err: unknown): boolean {
  const e = err as { response?: unknown; request?: unknown; code?: string };
  return !!e && e.response === undefined && (e.request !== undefined || e.code === 'ERR_NETWORK');
}

let flushing = false;

/** Bando išsiųsti visas eilėje laukiančias išlaidas. Grąžina kiek išsiuntė. */
export async function flushQueue(): Promise<number> {
  if (flushing) return 0;
  const items = read();
  if (items.length === 0) return 0;

  flushing = true;
  let sent = 0;
  try {
    const remaining: QueuedExpense[] = [];
    const today = new Date().toISOString().slice(0, 10);
    for (const item of items) {
      try {
        await expensesApi.createExpense({
          category: item.category,
          amount: item.amount,
          note: item.note,
          date: item.date !== today ? item.date : undefined,
        });
        sent++;
      } catch (err) {
        if (isNetworkError(err)) {
          remaining.push(item); // vis dar offline — paliekam eilėje
        }
        // 4xx (pvz., ištrinta kategorija) — įrašo nebekartojam, kad neužstrigtų eilė
      }
    }
    write(remaining);
  } finally {
    flushing = false;
  }
  return sent;
}

/** Užregistruoja automatinį siuntimą atsiradus ryšiui */
export function initOfflineSync(onFlushed?: (sent: number) => void) {
  const tryFlush = async () => {
    const sent = await flushQueue();
    if (sent > 0 && onFlushed) onFlushed(sent);
  };
  window.addEventListener('online', tryFlush);
  tryFlush(); // bandome iškart paleidus programėlę
}
