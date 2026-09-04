export type Person = { id: string; name: string };

export type PlanItem = {
  id: string;
  date: string;
  hour: number;
  title: string;
  note: string;
};

export type Expense = {
  id: string;
  category: string;
  date: string;
  note: string;
  amounts: Record<string, number>;
  paidBy: string; // person id who paid this expense
};

export type Photo = {
  id: string;
  path: string;
  url: string;
  caption: string;
  uploaderName: string;
  takenAt: number;
  createdAt: number;
};

export type TabLabels = {
  setup: string;
  album: string;
  money: string;
  photos: string;
};

export type Trip = {
  shareCode: string;
  title: string;
  city: string;
  mapPath: string;
  mapUrl: string;
  coverImagePath: string;
  coverImageUrl: string;
  startDate: string;
  endDate: string;
  people: Person[];
  itinerary: PlanItem[];
  expenses: Expense[];
  photos: Photo[];
  tabLabels: TabLabels;
  updatedAt: number;
};

export const CATEGORIES = ["交通", "住宿", "吃饭", "门票", "购物", "其他"] as const;
