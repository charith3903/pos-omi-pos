'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type Locale = 'en' | 'si' | 'ta';

const TRANSLATIONS: Record<Locale, Record<string, string>> = {
  en: {
    // Nav
    'nav.home':       'Home',
    'nav.billing':    'Billing',
    'nav.products':   'Products',
    'nav.reports':    'Reports',
    'nav.sales':      'Sales Report',
    'nav.productRpt': 'Product Report',
    'nav.stock':      'Stock Report',
    'nav.customers':  'Customer Report',
    'nav.signout':    'Sign out',

    // KPIs
    'kpi.todaySales':   "Today's Sales",
    'kpi.itemsSold':    'Items Sold',
    'kpi.profit':       'Profit',
    'kpi.invoices':     'Invoices',
    'kpi.totalSales':   'Total Sales',
    'kpi.taxCollected': 'Tax Collected',

    // Periods
    'period.today':   'Today',
    'period.week':    'This Week',
    'period.month':   'This Month',
    'period.custom':  'Custom Range',

    // Reports
    'report.from':       'From',
    'report.to':         'To',
    'report.outlet':     'Outlet',
    'report.allOutlets': 'All outlets',
    'report.groupBy':    'Group by',
    'report.day':        'Day',
    'report.week':       'Week',
    'report.month':      'Month',
    'report.export':     'Export CSV',
    'report.print':      'Print / PDF',
    'report.refresh':    'Refresh',
    'report.noData':     'No data for this period.',
    'report.loading':    'Loading…',

    // Sales
    'sales.trend':       'Sales Trend',
    'sales.cashier':     'By Cashier / Device',
    'sales.revenue':     'Revenue',
    'sales.tax':         'Tax',
    'sales.profit':      'Profit',
    'sales.invoices':    'Invoices',

    // Products
    'product.top':       'Top Products',
    'product.slow':      'Slow Movers',
    'product.name':      'Product',
    'product.qty':       'Qty Sold',
    'product.revenue':   'Revenue',
    'product.profit':    'Profit',
    'product.stock':     'Current Stock',
    'product.metric':    'Metric',

    // Stock
    'stock.value':       'Stock Value',
    'stock.lowStock':    'Low Stock Alerts',
    'stock.deadStock':   'Dead Stock',
    'stock.category':    'Category',
    'stock.totalValue':  'Total Value',
    'stock.totalQty':    'Total Qty',
    'stock.threshold':   'Threshold',

    // Customers
    'customer.top':      'Top Customers',
    'customer.name':     'Customer',
    'customer.phone':    'Phone',
    'customer.spent':    'Total Spent',
    'customer.visits':   'Invoices',
    'customer.last':     'Last Purchase',
  },

  si: {
    'nav.home':       'මුල් පිටුව',
    'nav.billing':    'බිල්',
    'nav.products':   'නිෂ්පාදන',
    'nav.reports':    'වාර්තා',
    'nav.sales':      'විකුණුම් වාර්තාව',
    'nav.productRpt': 'නිෂ්පාදන වාර්තාව',
    'nav.stock':      'තොග වාර්තාව',
    'nav.customers':  'ගනුදෙනුකරු වාර්තාව',
    'nav.signout':    'නික්ම යන්න',

    'kpi.todaySales':   'අද විකුණුම්',
    'kpi.itemsSold':    'විකිණූ භාණ්ඩ',
    'kpi.profit':       'ලාභය',
    'kpi.invoices':     'ඉන්වොයිස්',
    'kpi.totalSales':   'සම්පූර්ණ විකුණුම්',
    'kpi.taxCollected': 'කරය',

    'period.today':   'අද',
    'period.week':    'මෙ සතිය',
    'period.month':   'මෙ මාසය',
    'period.custom':  'අභිරුචි කාලය',

    'report.from':       'සිට',
    'report.to':         'දක්වා',
    'report.outlet':     'ශාඛාව',
    'report.allOutlets': 'සියලු ශාඛා',
    'report.groupBy':    'කාල කාණ්ඩය',
    'report.day':        'දිනය',
    'report.week':       'සතිය',
    'report.month':      'මාසය',
    'report.export':     'CSV ලෙස ඉවත් කරන්න',
    'report.print':      'මුද්‍රණය / PDF',
    'report.refresh':    'යාවත්කාලීන කරන්න',
    'report.noData':     'මෙ කාලය සඳහා දත්ත නොමැත.',
    'report.loading':    'පූරණය…',

    'sales.trend':       'විකුණුම් ප්‍රවණතාව',
    'sales.cashier':     'කාවිළිකරු / උපාංගය',
    'sales.revenue':     'ආදායම',
    'sales.tax':         'බදු',
    'sales.profit':      'ලාභය',
    'sales.invoices':    'ඉන්වොයිස්',

    'product.top':       'ඉහළ නිෂ්පාදන',
    'product.slow':      'සෙමෙන් යන නිෂ්පාදන',
    'product.name':      'නිෂ්පාදනය',
    'product.qty':       'විකිණූ ප්‍රමාණය',
    'product.revenue':   'ආදායම',
    'product.profit':    'ලාභය',
    'product.stock':     'වර්තමාන තොගය',
    'product.metric':    'මිනුම',

    'stock.value':       'තොග අගය',
    'stock.lowStock':    'අඩු තොග ඇඟවීම්',
    'stock.deadStock':   'ජීවය නැති තොගය',
    'stock.category':    'කාණ්ඩය',
    'stock.totalValue':  'සම්පූර්ණ අගය',
    'stock.totalQty':    'සම්පූර්ණ ප්‍රමාණය',
    'stock.threshold':   'සීමාව',

    'customer.top':      'ඉහළ ගනුදෙනුකරුවන්',
    'customer.name':     'ගනුදෙනුකරු',
    'customer.phone':    'දුරකතන',
    'customer.spent':    'සම්පූර්ණ වියදම',
    'customer.visits':   'ඉන්වොයිස්',
    'customer.last':     'අවසාන මිලදී ගැනීම',
  },

  ta: {
    'nav.home':       'முகப்பு',
    'nav.billing':    'பில்லிங்',
    'nav.products':   'பொருட்கள்',
    'nav.reports':    'அறிக்கைகள்',
    'nav.sales':      'விற்பனை அறிக்கை',
    'nav.productRpt': 'பொருள் அறிக்கை',
    'nav.stock':      'இருப்பு அறிக்கை',
    'nav.customers':  'வாடிக்கையாளர் அறிக்கை',
    'nav.signout':    'வெளியேறு',

    'kpi.todaySales':   'இன்றைய விற்பனை',
    'kpi.itemsSold':    'விற்ற பொருட்கள்',
    'kpi.profit':       'லாபம்',
    'kpi.invoices':     'இன்வாய்ஸ்கள்',
    'kpi.totalSales':   'மொத்த விற்பனை',
    'kpi.taxCollected': 'வரி',

    'period.today':   'இன்று',
    'period.week':    'இந்த வாரம்',
    'period.month':   'இந்த மாதம்',
    'period.custom':  'தனிப்பயன் காலம்',

    'report.from':       'தொடக்கம்',
    'report.to':         'முடிவு',
    'report.outlet':     'கடை',
    'report.allOutlets': 'அனைத்து கடைகள்',
    'report.groupBy':    'தொகுப்பு',
    'report.day':        'நாள்',
    'report.week':       'வாரம்',
    'report.month':      'மாதம்',
    'report.export':     'CSV ஏற்றுமதி',
    'report.print':      'அச்சிடு / PDF',
    'report.refresh':    'புதுப்பி',
    'report.noData':     'இந்த காலகட்டத்தில் தரவு இல்லை.',
    'report.loading':    'ஏற்றுகிறது…',

    'sales.trend':       'விற்பனை போக்கு',
    'sales.cashier':     'காசாளர் / சாதனம்',
    'sales.revenue':     'வருவாய்',
    'sales.tax':         'வரி',
    'sales.profit':      'லாபம்',
    'sales.invoices':    'இன்வாய்ஸ்கள்',

    'product.top':       'சிறந்த பொருட்கள்',
    'product.slow':      'மெதுவான இயக்கிகள்',
    'product.name':      'பொருள்',
    'product.qty':       'விற்ற அளவு',
    'product.revenue':   'வருவாய்',
    'product.profit':    'லாபம்',
    'product.stock':     'தற்போதைய இருப்பு',
    'product.metric':    'அளவீடு',

    'stock.value':       'இருப்பு மதிப்பு',
    'stock.lowStock':    'குறைந்த இருப்பு எச்சரிக்கைகள்',
    'stock.deadStock':   'இறந்த இருப்பு',
    'stock.category':    'வகை',
    'stock.totalValue':  'மொத்த மதிப்பு',
    'stock.totalQty':    'மொத்த அளவு',
    'stock.threshold':   'வரம்பு',

    'customer.top':      'சிறந்த வாடிக்கையாளர்கள்',
    'customer.name':     'வாடிக்கையாளர்',
    'customer.phone':    'தொலைபேசி',
    'customer.spent':    'மொத்த செலவு',
    'customer.visits':   'இன்வாய்ஸ்கள்',
    'customer.last':     'கடந்த கொள்முதல்',
  },
};

// ── Context ───────────────────────────────────────────────────────────────────

interface I18nCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, fallback?: string) => string;
}

import React from 'react';

const I18nContext = createContext<I18nCtx>({
  locale: 'en',
  setLocale: () => {},
  t: (k) => k,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const stored = (localStorage.getItem('omnipos_locale') as Locale | null) ?? 'en';
    setLocaleState(stored);
  }, []);

  const setLocale = useCallback((l: Locale) => {
    localStorage.setItem('omnipos_locale', l);
    setLocaleState(l);
  }, []);

  const t = useCallback(
    (key: string, fallback?: string) =>
      TRANSLATIONS[locale][key] ?? TRANSLATIONS.en[key] ?? fallback ?? key,
    [locale],
  );

  return React.createElement(I18nContext.Provider, { value: { locale, setLocale, t } }, children);
}

export function useI18n() {
  return useContext(I18nContext);
}

/** Format currency with LKR (Sri Lankan Rupee) */
export function fmtCurrency(value: number): string {
  return new Intl.NumberFormat('si-LK', { style: 'currency', currency: 'LKR', maximumFractionDigits: 2 }).format(value);
}

/** Format a date consistently regardless of locale */
export function fmtDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Format number with thousand separators */
export function fmtNum(value: number, decimals = 0): string {
  return value.toLocaleString('en', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
