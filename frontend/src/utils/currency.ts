const PRICE_FORMATTER = new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
});

export const formatPrice = (value: number) => PRICE_FORMATTER.format(value);
