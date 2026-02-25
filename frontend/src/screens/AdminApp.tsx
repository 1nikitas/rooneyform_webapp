import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Layout } from '../components/Layout';
import apiClient, { ADMIN_TOKEN_KEY, ADMIN_LOGIN_PATH } from '../api/client';
import type { Product, Order } from '../types';
import { formatPrice } from '../utils/currency';
import { resolveAssetUrl } from '../utils/assets';
import { SlidingNumber } from '../components/animate-ui/primitives/texts/sliding-number';
import { BRANDS, LEAGUES, LEAGUE_CLUBS, SIZES, SEASONS, KIT_TYPES } from '../constants/referenceData';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_SLIDER_DAYS = 30;
const DEFAULT_RANGE_DAYS = 7;
const PRODUCT_LIMIT = 500;

const ORDER_STATUS_VARIANTS = {
  received: {
    label: 'Получен',
    badgeClass: 'status-badge status-received',
    markerClass: 'status-marker-muted',
    pulseClass: 'status-pulse',
    lineClass: 'status-line',
  },
  paid: {
    label: 'Оплачен',
    badgeClass: 'status-badge status-paid',
    markerClass: 'status-marker',
    pulseClass: 'status-pulse',
    lineClass: 'status-line',
  },
  completed: {
    label: 'Завершен',
    badgeClass: 'status-badge status-completed',
    markerClass: 'status-marker',
    pulseClass: 'status-pulse',
    lineClass: 'status-line',
  },
} as const;

const ORDER_STATUS_LIST: Order['status'][] = ['received', 'paid', 'completed'];

const formatInputDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseInputDate = (value: string, endOfDay = false) => {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date;
};

const getInitialDateRange = () => {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end.getTime() - DEFAULT_RANGE_DAYS * DAY_MS);
  start.setHours(0, 0, 0, 0);
  return { start, end };
};

export default function AdminApp() {
  const initialRange = useMemo(getInitialDateRange, []);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [daysRange, setDaysRange] = useState(DEFAULT_RANGE_DAYS);
  const [adminTab, setAdminTab] = useState<'products' | 'orders'>('products');
  const [productTab, setProductTab] = useState<'jerseys' | 'posters'>('jerseys');
  const [rangeStart, setRangeStart] = useState<Date>(initialRange.start);
  const [rangeEnd, setRangeEnd] = useState<Date>(initialRange.end);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [dateInputs, setDateInputs] = useState({
    start: formatInputDate(initialRange.start),
    end: formatInputDate(initialRange.end),
  });
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    tg_post_url: '',
    team: '',
    size: 'L',
    brand: '',
    league: '',
    season: '',
    kit_type: '',
    category_slug: 'premier-league',
  });
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    price: '',
    tg_post_url: '',
    team: '',
    size: '',
    brand: '',
    league: '',
    season: '',
    kit_type: '',
    category_slug: 'premier-league',
  });
  const [editExistingImages, setEditExistingImages] = useState<string[]>([]);
  const [editNewImages, setEditNewImages] = useState<{ file: File; preview: string }[]>([]);
  const editUploadsRef = useRef(editNewImages);
  const [editCover, setEditCover] = useState<{ kind: 'existing' | 'new'; index: number } | null>(null);
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [uploads, setUploads] = useState<{ file: File; preview: string }[]>([]);
  const uploadsRef = useRef(uploads);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const rangeStartMs = rangeStart.getTime();
  const rangeEndMs = rangeEnd.getTime();
  const rangeDuration = Math.max(rangeEndMs - rangeStartMs, 1);
  const selectedDays = Math.max(1, Math.round(rangeDuration / DAY_MS));
  const productsById = useMemo(() => {
    const map = new Map<number, Product>();
    products.forEach((product) => map.set(product.id, product));
    return map;
  }, [products]);
  const revenueTotal = useMemo(
    () => orders.reduce((sum, order) => sum + order.total_price, 0),
    [orders],
  );
  const resolveImageSrc = (path?: string) => {
    if (!path) return 'https://via.placeholder.com/160x160?text=Нет+фото';
    return resolveAssetUrl(path);
  };
  const normalizeAssetPath = (path: string) => {
    try {
      const url = new URL(path);
      if (url.pathname.startsWith('/static/')) {
        return url.pathname.replace(/^\/+/, '');
      }
      return path;
    } catch {
      if (path.startsWith('/static/')) {
        return path.replace(/^\/+/, '');
      }
      return path;
    }
  };
  const formatRangeDate = (date: Date, includeYear = false) =>
    date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'short',
      ...(includeYear ? { year: 'numeric' } : {}),
    });
  const selectedRangeLabel = `${formatRangeDate(rangeStart, true)} — ${formatRangeDate(rangeEnd, true)}`;
  const isPosterTab = productTab === 'posters';
  const isPosterEdit = editForm.category_slug === 'posters';
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const isPoster = product.category?.slug === 'posters';
      return isPosterTab ? isPoster : !isPoster;
    });
  }, [products, isPosterTab]);

  const loadProducts = async () => {
    const res = await apiClient.get(`/products/?limit=${PRODUCT_LIMIT}`);
    setProducts(res.data);
  };
  const loadOrders = async (customStart?: Date, customEnd?: Date) => {
    const startDate = customStart ?? rangeStart;
    const endDate = customEnd ?? rangeEnd;
    const params = new URLSearchParams();
    params.append('start_date', startDate.toISOString());
    params.append('end_date', endDate.toISOString());
    const res = await apiClient.get(`/orders/?${params.toString()}`);
    setOrders(res.data);
  };

  useEffect(() => {
    loadProducts();
    loadOrders();
  }, []);

  useEffect(() => {
    setForm((prev) => {
      if (isPosterTab) {
        return {
          ...prev,
          team: '',
          size: '',
          brand: '',
          league: '',
          season: '',
          kit_type: '',
          category_slug: 'posters',
        };
      }
      return {
        ...prev,
        category_slug: prev.category_slug === 'posters' ? 'premier-league' : prev.category_slug,
      };
    });
  }, [isPosterTab]);

  useEffect(() => {
    uploadsRef.current = uploads;
  }, [uploads]);

  useEffect(() => () => {
    uploadsRef.current.forEach(({ preview }) => URL.revokeObjectURL(preview));
  }, []);

  useEffect(() => {
    editUploadsRef.current = editNewImages;
  }, [editNewImages]);

  useEffect(() => () => {
    editUploadsRef.current.forEach(({ preview }) => URL.revokeObjectURL(preview));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploads((prev) => {
      const next = [...prev];
      const existing = new Set(
        prev.map((item) => `${item.file.name}-${item.file.size}-${item.file.lastModified}`),
      );
      for (const file of files) {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (existing.has(key)) continue;
        next.push({ file, preview: URL.createObjectURL(file) });
        existing.add(key);
      }
      return next;
    });
    e.target.value = '';
  };

  const removeUpload = (index: number) => {
    setUploads((prev) => {
      const target = prev[index];
      if (target) {
        URL.revokeObjectURL(target.preview);
      }
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const resetUploads = () => {
    uploadsRef.current.forEach(({ preview }) => URL.revokeObjectURL(preview));
    setUploads([]);
  };

  const pickDefaultCover = (existing: string[], incoming: { file: File; preview: string }[]) => {
    if (existing.length) return { kind: 'existing', index: 0 } as const;
    if (incoming.length) return { kind: 'new', index: 0 } as const;
    return null;
  };

  const openEditModal = (product: Product) => {
    const initialImages = product.gallery?.length
      ? product.gallery
      : product.image_url
        ? [product.image_url]
        : [];
    const normalizedImages = initialImages.map((image) => normalizeAssetPath(image));
    setEditingProduct(product);
    setEditForm({
      name: product.name,
      description: product.description ?? '',
      price: String(product.price ?? ''),
      tg_post_url: product.tg_post_url ?? '',
      team: product.team ?? '',
      size: product.size ?? '',
      brand: product.brand ?? '',
      league: product.league ?? '',
      season: product.season ?? '',
      kit_type: product.kit_type ?? '',
      category_slug: product.category?.slug ?? 'premier-league',
    });
    setEditExistingImages(normalizedImages);
    setEditNewImages([]);
    setEditCover(normalizedImages.length ? { kind: 'existing', index: 0 } : null);
  };

  const closeEditModal = () => {
    editUploadsRef.current.forEach(({ preview }) => URL.revokeObjectURL(preview));
    setEditingProduct(null);
    setEditExistingImages([]);
    setEditNewImages([]);
    setEditCover(null);
    setIsEditSaving(false);
  };

  const handleEditFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setEditNewImages((prev) => {
      const next = [...prev];
      const existing = new Set(
        prev.map((item) => `${item.file.name}-${item.file.size}-${item.file.lastModified}`),
      );
      for (const file of files) {
        const key = `${file.name}-${file.size}-${file.lastModified}`;
        if (existing.has(key)) continue;
        next.push({ file, preview: URL.createObjectURL(file) });
        existing.add(key);
      }
      setEditCover((current) => current ?? pickDefaultCover(editExistingImages, next));
      return next;
    });
    e.target.value = '';
  };

  const removeEditExisting = (index: number) => {
    setEditExistingImages((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      setEditCover((current) => {
        if (!current) return pickDefaultCover(next, editNewImages);
        if (current.kind !== 'existing') return current;
        if (current.index === index) return pickDefaultCover(next, editNewImages);
        if (current.index > index) return { ...current, index: current.index - 1 };
        return current;
      });
      return next;
    });
  };

  const removeEditNew = (index: number) => {
    setEditNewImages((prev) => {
      const target = prev[index];
      if (target) {
        URL.revokeObjectURL(target.preview);
      }
      const next = prev.filter((_, idx) => idx !== index);
      setEditCover((current) => {
        if (!current) return pickDefaultCover(editExistingImages, next);
        if (current.kind !== 'new') return current;
        if (current.index === index) return pickDefaultCover(editExistingImages, next);
        if (current.index > index) return { ...current, index: current.index - 1 };
        return current;
      });
      return next;
    });
  };

  const handleEditSubmit = async () => {
    if (!editingProduct || isEditSaving) return;
    const totalImages = editExistingImages.length + editNewImages.length;
    if (totalImages === 0) {
      alert('Добавьте хотя бы одно фото товара.');
      return;
    }
    setIsEditSaving(true);
    try {
      let uploadedFiles: string[] = [];
      if (editNewImages.length) {
        const formData = new FormData();
        editNewImages.forEach(({ file }) => formData.append('files', file));
        const uploadRes = await apiClient.post('/uploads/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        uploadedFiles = (uploadRes.data?.files ?? []) as string[];
      }
      const allImages = [...editExistingImages, ...uploadedFiles];
      let coverPath = allImages[0];
      if (editCover?.kind === 'existing') {
        coverPath = editExistingImages[editCover.index] ?? coverPath;
      } else if (editCover?.kind === 'new') {
        coverPath = uploadedFiles[editCover.index] ?? coverPath;
      }
      if (!coverPath) {
        alert('Не удалось определить обложку.');
        return;
      }
      const orderedGallery = [coverPath, ...allImages.filter((path) => path !== coverPath)];
      await apiClient.put(`/products/${editingProduct.id}`, {
        ...editForm,
        price: Number(editForm.price),
        image_url: orderedGallery[0],
        gallery: orderedGallery.slice(1),
      });
      closeEditModal();
      loadProducts();
    } catch (error) {
      console.error(error);
      alert('Не удалось сохранить изменения.');
      setIsEditSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!uploads.length) {
      alert('Добавьте хотя бы одно фото товара.');
      return;
    }
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      uploads.forEach(({ file }) => formData.append('files', file));
      const uploadRes = await apiClient.post('/uploads/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const uploadedFiles = (uploadRes.data?.files ?? []) as string[];
      if (!uploadedFiles.length) {
        alert('Не удалось загрузить изображения.');
        return;
      }
      await apiClient.post('/products/', {
        ...form,
        price: Number(form.price),
        image_url: uploadedFiles[0],
        gallery: uploadedFiles.slice(1),
      });
      setForm({ ...form, name: '', description: '', price: '', tg_post_url: '' });
      resetUploads();
      loadProducts();
    } catch (error) {
      console.error(error);
      alert('Не удалось сохранить товар. Попробуйте еще раз.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    await apiClient.delete(`/products/${id}`);
    loadProducts();
  };
  const handleRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setDaysRange(value);
    const nextStart = new Date(rangeEnd.getTime() - value * DAY_MS);
    setRangeStart(nextStart);
    setDateInputs((prev) => ({ ...prev, start: formatInputDate(nextStart) }));
    loadOrders(nextStart, rangeEnd);
  };
  const sliderPercent = ((daysRange - 1) / (MAX_SLIDER_DAYS - 1)) * 100;
  const timelineOrders = useMemo(() => {
    if (!orders.length || rangeDuration <= 0) return [];
    const MIN_EDGE = 4;
    const MAX_EDGE = 96;
    const MIN_GAP = 10;
    const MAX_ATTEMPTS = 8;
    const sorted = [...orders].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const placed: Array<{ order: Order; position: number; alignTop: boolean }> = [];

    sorted.forEach((order, index) => {
      const orderTime = new Date(order.created_at).getTime();
      const ratio = (orderTime - rangeStartMs) / rangeDuration;
      const basePosition = Math.min(MAX_EDGE, Math.max(MIN_EDGE, ratio * 100));
      let position = basePosition;
      let attempts = 0;

      while (
        placed.some((entry) => Math.abs(entry.position - position) < MIN_GAP) &&
        attempts < MAX_ATTEMPTS
      ) {
        attempts += 1;
        const direction = attempts % 2 === 0 ? 1 : -1;
        const step = Math.ceil(attempts / 2) * (MIN_GAP / 2);
        position = Math.min(
          MAX_EDGE,
          Math.max(MIN_EDGE, basePosition + direction * step),
        );
      }

      placed.push({
        order,
        position,
        alignTop: index % 2 === 0,
      });
    });

    return placed;
  }, [orders, rangeStartMs, rangeDuration]);
  const timelineLabels = useMemo(() => {
    if (rangeDuration <= 0) return [];
    return Array.from({ length: 5 }, (_, idx) => {
      const point = rangeStartMs + (rangeDuration * idx) / 4;
      return new Date(point).toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: 'short',
      });
    });
  }, [rangeStartMs, rangeDuration]);
  const handleDateFieldChange = (key: 'start' | 'end') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setDateInputs((prev) => ({ ...prev, [key]: value }));
  };

  const handleApplyDateFilter = () => {
    const startDate = parseInputDate(dateInputs.start);
    const endDate = parseInputDate(dateInputs.end, true);
    if (!startDate || !endDate) {
      alert('Укажите корректные даты');
      return;
    }
    if (startDate > endDate) {
      alert('Дата начала не может быть позже даты окончания');
      return;
    }
    setRangeStart(startDate);
    setRangeEnd(endDate);
    const diffDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / DAY_MS));
    setDaysRange(Math.min(MAX_SLIDER_DAYS, diffDays));
    setDateInputs({
      start: formatInputDate(startDate),
      end: formatInputDate(endDate),
    });
    loadOrders(startDate, endDate);
  };

  const handleStatusChange = async (orderId: number, status: Order['status']) => {
    try {
      const res = await apiClient.patch(`/orders/${orderId}`, { status });
      setOrders((prev) =>
        prev.map((order) => (order.id === orderId ? res.data : order)),
      );
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(res.data);
      }
    } catch (error) {
      console.error('Не удалось обновить статус заказа', error);
      alert('Не удалось обновить статус заказа. Попробуйте еще раз.');
    }
  };
  const formatOrderMoment = (value: string) =>
    new Date(value).toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(ADMIN_TOKEN_KEY);
      } catch {
        // ignore
      }
      window.location.href = ADMIN_LOGIN_PATH;
    }
  };

  return (
    <Layout containerClassName="max-w-6xl">
      <div className="space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">Админ-панель</h1>
            <p className="text-xs text-tg-hint">Управление товарами и заказами</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`px-4 py-2 rounded-full text-sm font-semibold transition ${adminTab === 'products' ? 'badge-contrast' : 'surface-muted text-tg-hint'}`}
                onClick={() => setAdminTab('products')}
              >
                Товары
              </button>
              <button
                type="button"
                className={`px-4 py-2 rounded-full text-sm font-semibold transition ${adminTab === 'orders' ? 'badge-contrast' : 'surface-muted text-tg-hint'}`}
                onClick={() => setAdminTab('orders')}
              >
                Заказы
              </button>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-2 rounded-full text-xs font-semibold surface-muted text-tg-hint hover:text-tg-text transition"
            >
              Выйти
            </button>
          </div>
        </header>

        {adminTab === 'products' && (
          <>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={`px-4 py-2 rounded-full text-sm font-semibold transition ${productTab === 'jerseys' ? 'badge-contrast' : 'surface-muted text-tg-hint'}`}
                onClick={() => setProductTab('jerseys')}
              >
                Футболки
              </button>
              <button
                type="button"
                className={`px-4 py-2 rounded-full text-sm font-semibold transition ${productTab === 'posters' ? 'badge-contrast' : 'surface-muted text-tg-hint'}`}
                onClick={() => setProductTab('posters')}
              >
                Плакаты
              </button>
            </div>
            <section className="glass-card rounded-3xl p-6 space-y-4">
              <h2 className="text-lg font-semibold">
                Добавить {productTab === 'posters' ? 'плакат' : 'футболку'}
              </h2>
              <form className="space-y-3" onSubmit={handleSubmit}>
                <input className="tg-input" name="name" placeholder="Название" value={form.name} onChange={handleChange} required />
                <textarea className="tg-input" name="description" placeholder="Описание" value={form.description} onChange={handleChange} />
                <input
                  className="tg-input"
                  name="tg_post_url"
                  placeholder="Ссылка на пост в Telegram"
                  value={form.tg_post_url}
                  onChange={handleChange}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input className="tg-input" name="price" placeholder="Цена (₽)" value={form.price} onChange={handleChange} required type="number" min="0" />
                  {!isPosterTab && (
                    <input className="tg-input" name="team" placeholder="Команда (для названия)" value={form.team} onChange={handleChange} />
                  )}
                </div>
                {!isPosterTab && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <label className="text-xs font-semibold text-tg-hint space-y-1">
                        <span className="uppercase tracking-wide text-[11px]">Бренд</span>
                        <select className="tg-input" name="brand" value={form.brand} onChange={handleChange}>
                          <option value="">— Выберите —</option>
                          {BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-tg-hint space-y-1">
                        <span className="uppercase tracking-wide text-[11px]">Лига</span>
                        <select className="tg-input" name="league" value={form.league} onChange={(e) => {
                          handleChange(e);
                          // Reset team when league changes
                          setForm((prev) => ({ ...prev, league: e.target.value, team: '' }));
                        }}>
                          <option value="">— Выберите —</option>
                          {LEAGUES.map((l) => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </label>
                    </div>
                    {form.league && LEAGUE_CLUBS[form.league]?.length > 0 && (
                      <label className="text-xs font-semibold text-tg-hint space-y-1">
                        <span className="uppercase tracking-wide text-[11px]">Клуб</span>
                        <select className="tg-input" name="team" value={form.team} onChange={handleChange}>
                          <option value="">— Выберите клуб —</option>
                          {LEAGUE_CLUBS[form.league].map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </label>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <label className="text-xs font-semibold text-tg-hint space-y-1">
                        <span className="uppercase tracking-wide text-[11px]">Размер</span>
                        <select className="tg-input" name="size" value={form.size} onChange={handleChange}>
                          <option value="">— Выберите —</option>
                          {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-tg-hint space-y-1">
                        <span className="uppercase tracking-wide text-[11px]">Сезон</span>
                        <select className="tg-input" name="season" value={form.season} onChange={handleChange}>
                          <option value="">— Выберите —</option>
                          {SEASONS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-tg-hint space-y-1">
                        <span className="uppercase tracking-wide text-[11px]">Тип</span>
                        <select className="tg-input" name="kit_type" value={form.kit_type} onChange={handleChange}>
                          <option value="">— Выберите —</option>
                          {KIT_TYPES.map((k) => <option key={k} value={k}>{k}</option>)}
                        </select>
                      </label>
                    </div>
                    <input type="hidden" name="category_slug" value={form.category_slug} />
                  </>
                )}
                {isPosterTab && (
                  <input type="hidden" name="category_slug" value="posters" />
                )}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-[0.2em] text-tg-hint">Фотографии</span>
                    {uploads.length > 0 && (
                      <span className="text-xs text-tg-hint opacity-70">
                        {uploads.length} шт.
                      </span>
                    )}
                  </div>
                  <div className="rounded-2xl border border-dashed border-[var(--tg-border-subtle)] bg-[var(--tg-surface-2)] p-4">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFilesSelected}
                      className="w-full text-sm text-tg-hint file:mr-4 file:rounded-full file:border-0 file:bg-[var(--tg-theme-text-color)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[var(--tg-theme-bg-color)] hover:file:opacity-90"
                    />
                    <p className="mt-2 text-xs text-tg-hint opacity-70">
                      Можно выбрать несколько фото, первое будет обложкой товара.
                    </p>
                  </div>
                  {uploads.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {uploads.map((item, index) => (
                        <div
                          key={`${item.file.name}-${index}`}
                          className="relative overflow-hidden rounded-2xl surface-card"
                        >
                          <img src={item.preview} alt={`preview-${index}`} className="h-24 w-full object-cover" />
                          {index === 0 && (
                            <span className="absolute left-2 top-2 rounded-full badge-contrast px-2 py-0.5 text-[10px] font-semibold">
                              Обложка
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => removeUpload(index)}
                            className="absolute right-2 top-2 rounded-full bg-[rgba(var(--tg-ink-rgb),0.55)] p-1 text-[var(--tg-theme-bg-color)] hover:bg-[rgba(var(--tg-ink-rgb),0.7)]"
                            aria-label="Удалить фото"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="submit"
                  className={`w-full py-3 rounded-2xl btn-primary font-semibold ${
                    isSubmitting ? 'opacity-70 cursor-wait' : ''
                  }`}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Сохраняем...' : 'Сохранить'}
                </button>
              </form>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold">
                Текущие {productTab === 'posters' ? 'плакаты' : 'футболки'}
              </h2>
              <div className="space-y-3">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openEditModal(product)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openEditModal(product);
                      }
                    }}
                    className="glass-card rounded-3xl p-4 flex flex-col gap-4 sm:flex-row sm:items-center cursor-pointer transition hover:-translate-y-0.5 hover:border-[var(--tg-border-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tg-theme-text-color)]"
                  >
                    <img src={resolveImageSrc(product.gallery?.[0] || product.image_url)} alt={product.name} className="w-20 h-20 rounded-2xl object-cover" />
                    <div className="flex-1">
                      <p className="text-xs text-tg-hint uppercase">{product.category?.name}</p>
                      <h3 className="font-semibold">{product.name}</h3>
                      <p className="text-sm text-tg-hint">
                        {[product.team, product.size, product.brand, product.league, product.season, product.kit_type].filter(Boolean).join(' • ') || 'Без характеристик'}
                      </p>
                      <p className="text-xs text-tg-hint mt-1">Нажмите для редактирования</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-sm font-semibold text-tg-text">{product.price} ₽</span>
                      <button
                        type="button"
                        className="text-xs text-tg-hint hover:text-tg-text transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(product.id);
                        }}
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="glass-card rounded-2xl px-6 py-10 text-center text-tg-hint">
                    Пока нет товаров в этой вкладке.
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {adminTab === 'orders' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Заказы</h2>
          </div>
          <div className="glass-card rounded-3xl p-4 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-xs text-tg-hint uppercase tracking-widest">Быстрый диапазон</span>
                <p className="text-sm font-semibold text-tg-text">до {formatRangeDate(rangeEnd)}</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-tg-hint uppercase tracking-widest">Длительность</span>
                <p className="text-sm font-semibold text-tg-text">{daysRange} дн.</p>
              </div>
            </div>
            <input
              type="range"
              min={1}
              max={MAX_SLIDER_DAYS}
              value={daysRange}
              onChange={handleRangeChange}
              className="time-slider w-full"
              style={{
                background: `linear-gradient(90deg, var(--tg-theme-text-color) ${sliderPercent}%, rgba(var(--tg-ink-rgb),0.2) ${sliderPercent}%)`,
              }}
            />
            <div className="flex justify-between text-xs text-tg-hint">
              <span>1 день</span>
              <span>{MAX_SLIDER_DAYS} дн.</span>
            </div>
          </div>

          <div className="glass-card rounded-3xl p-4 space-y-4">
            <div>
              <span className="text-xs text-tg-hint uppercase tracking-widest">Выбранный период</span>
              <p className="text-sm font-semibold text-tg-text">{selectedRangeLabel} · {selectedDays} дн.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-tg-hint space-y-1">
                <span className="uppercase tracking-wide text-[11px]">С даты</span>
                <input
                  type="date"
                  value={dateInputs.start}
                  onChange={handleDateFieldChange('start')}
                  className="tg-input py-2 text-sm"
                />
              </label>
              <label className="text-xs font-semibold text-tg-hint space-y-1">
                <span className="uppercase tracking-wide text-[11px]">По дату</span>
                <input
                  type="date"
                  value={dateInputs.end}
                  onChange={handleDateFieldChange('end')}
                  className="tg-input py-2 text-sm"
                />
              </label>
            </div>
            <button
              type="button"
              onClick={handleApplyDateFilter}
              className="w-full rounded-2xl btn-primary text-sm font-semibold active:scale-[0.99]"
            >
              Применить даты
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="glass-card rounded-2xl p-4">
              <p className="text-xs text-tg-hint">Заказы</p>
              <p className="text-2xl font-bold">{orders.length}</p>
            </div>
            <div className="glass-card rounded-2xl p-4">
              <p className="text-xs text-tg-hint">Выручка</p>
              <p className="text-2xl font-bold inline-flex items-baseline gap-1">
                <SlidingNumber number={revenueTotal} thousandSeparator=" " decimalPlaces={0} />
                <span className="text-xs font-semibold">₽</span>
              </p>
            </div>
          </div>

          <div className="glass-card rounded-3xl p-4 space-y-4 hidden lg:block">
            <div className="flex justify-between text-xs text-tg-hint uppercase tracking-widest">
              <span>{formatRangeDate(rangeStart)}</span>
              <span>{formatRangeDate(rangeEnd)}</span>
            </div>
            <div className="relative h-40">
              <div className="absolute left-8 right-8 top-1/2 h-1 bg-gradient-to-r from-[rgba(var(--tg-ink-rgb),0.18)] via-[rgba(var(--tg-ink-rgb),0.4)] to-[rgba(var(--tg-ink-rgb),0.18)]" />
              <div className="absolute left-8 right-8 top-1/2 flex justify-between text-[10px] text-tg-hint -translate-y-2 uppercase tracking-widest">
                {timelineLabels.map((label, idx) => (
                  <span key={`${label}-${idx}`}>{label}</span>
                ))}
              </div>
              {timelineOrders.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-tg-hint">
                  Заказы за выбранный период не найдены
                </div>
              ) : (
                timelineOrders.map(({ order, position, alignTop }) => {
                  const variant = ORDER_STATUS_VARIANTS[order.status];
                  return (
                    <div
                      key={order.id}
                      className="absolute flex w-32 flex-col items-center"
                      style={{ left: `calc(${position}% - 64px)` }}
                    >
                      {alignTop && (
                        <div className="mb-3 w-full rounded-2xl surface-card px-3 py-2 text-[11px] text-tg-text shadow-md">
                          <div className="flex items-center justify-between gap-1">
                            <p className="font-semibold">#{order.id}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${variant.badgeClass}`}>
                              {variant.label}
                            </span>
                          </div>
                          <p className="text-sm font-semibold">{formatPrice(order.total_price)}</p>
                          <p className="text-[10px] text-tg-hint">{formatOrderMoment(order.created_at)}</p>
                        </div>
                      )}
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-[10px] text-tg-hint">
                          {new Date(order.created_at).toLocaleTimeString('ru-RU', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <div className="relative flex flex-col items-center">
                          <span className={`absolute -left-3 -top-3 h-10 w-10 rounded-full ${variant.pulseClass} animate-ping`} />
                          <div className={`h-5 w-px -translate-y-4 ${variant.lineClass}`} />
                          <div className={`relative z-10 h-4 w-4 rounded-full border-2 border-[var(--tg-theme-bg-color)] ${variant.markerClass} shadow`} />
                        </div>
                      </div>
                      {!alignTop && (
                        <div className="mt-3 w-full rounded-2xl surface-card px-3 py-2 text-[11px] text-tg-text shadow-md">
                          <div className="flex items-center justify-between gap-1">
                            <p className="font-semibold">#{order.id}</p>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${variant.badgeClass}`}>
                              {variant.label}
                            </span>
                          </div>
                          <p className="text-sm font-semibold">{formatPrice(order.total_price)}</p>
                          <p className="text-[10px] text-tg-hint">{formatOrderMoment(order.created_at)}</p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-3">
            {orders.map((order) => {
              const variant = ORDER_STATUS_VARIANTS[order.status];
              return (
                <div
                  key={order.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedOrder(order)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedOrder(order);
                    }
                  }}
                  className="glass-card rounded-3xl p-4 space-y-3 cursor-pointer transition hover:-translate-y-0.5 hover:border-[var(--tg-border-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tg-theme-text-color)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs text-tg-hint">{new Date(order.created_at).toLocaleString('ru-RU')}</p>
                      <h3 className="text-lg font-semibold text-tg-text">Заказ #{order.id}</h3>
                    </div>
                    <div className="flex flex-col items-end gap-2 text-right">
                      <span className="text-lg font-bold text-tg-text">{formatPrice(order.total_price)}</span>
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${variant.badgeClass}`}>
                        {variant.label}
                      </span>
                      <label className="text-[11px] uppercase tracking-wide text-tg-hint">
                        Сменить статус
                        <select
                          value={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value as Order['status'])}
                          onClick={(e) => e.stopPropagation()}
                          onFocus={(e) => e.stopPropagation()}
                          className="mt-1 w-36 tg-input py-1 text-xs font-semibold"
                        >
                          {ORDER_STATUS_LIST.map((status) => (
                            <option key={status} value={status}>
                              {ORDER_STATUS_VARIANTS[status].label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-tg-hint">
                    {order.items.map((item) => item.product_name).join(', ')}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        )}
      </div>

      <AnimatePresence>
        {editingProduct && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeEditModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl rounded-3xl surface-card p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-tg-hint uppercase tracking-widest">Редактирование</p>
                    <h3 className="text-xl font-semibold text-tg-text">Карточка товара</h3>
                    <p className="text-sm text-tg-hint">ID #{editingProduct.id}</p>
                  </div>
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="rounded-full icon-button p-2 hover:opacity-80"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-semibold text-tg-hint space-y-1">
                    <span className="uppercase tracking-wide text-[11px]">Название</span>
                    <input
                      className="tg-input"
                      name="name"
                      placeholder="Название товара"
                      value={editForm.name}
                      onChange={handleEditChange}
                      required
                    />
                  </label>
                  <label className="text-xs font-semibold text-tg-hint space-y-1">
                    <span className="uppercase tracking-wide text-[11px]">Описание</span>
                    <textarea
                      className="tg-input"
                      name="description"
                      placeholder="Описание товара"
                      value={editForm.description}
                      onChange={handleEditChange}
                      rows={4}
                    />
                  </label>
                  <label className="text-xs font-semibold text-tg-hint space-y-1">
                    <span className="uppercase tracking-wide text-[11px]">Ссылка на пост в Telegram</span>
                    <input
                      className="tg-input"
                      name="tg_post_url"
                      placeholder="https://t.me/..."
                      value={editForm.tg_post_url}
                      onChange={handleEditChange}
                    />
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="text-xs font-semibold text-tg-hint space-y-1">
                      <span className="uppercase tracking-wide text-[11px]">Цена</span>
                      <input
                        className="tg-input"
                        name="price"
                        placeholder="Цена (₽)"
                        value={editForm.price}
                        onChange={handleEditChange}
                        required
                        type="number"
                        min="0"
                      />
                    </label>
                    {!isPosterEdit && (
                      <label className="text-xs font-semibold text-tg-hint space-y-1">
                        <span className="uppercase tracking-wide text-[11px]">Команда (для названия)</span>
                        <input
                          className="tg-input"
                          name="team"
                          placeholder="Команда"
                          value={editForm.team}
                          onChange={handleEditChange}
                        />
                      </label>
                    )}
                  </div>
                  {!isPosterEdit && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="text-xs font-semibold text-tg-hint space-y-1">
                          <span className="uppercase tracking-wide text-[11px]">Бренд</span>
                          <select className="tg-input" name="brand" value={editForm.brand} onChange={handleEditChange}>
                            <option value="">— Выберите —</option>
                            {BRANDS.map((b) => <option key={b} value={b}>{b}</option>)}
                          </select>
                        </label>
                        <label className="text-xs font-semibold text-tg-hint space-y-1">
                          <span className="uppercase tracking-wide text-[11px]">Лига</span>
                          <select className="tg-input" name="league" value={editForm.league} onChange={(e) => {
                            handleEditChange(e);
                            setEditForm((prev) => ({ ...prev, league: e.target.value, team: '' }));
                          }}>
                            <option value="">— Выберите —</option>
                            {LEAGUES.map((l) => <option key={l} value={l}>{l}</option>)}
                          </select>
                        </label>
                      </div>
                      {editForm.league && LEAGUE_CLUBS[editForm.league]?.length > 0 && (
                        <label className="text-xs font-semibold text-tg-hint space-y-1">
                          <span className="uppercase tracking-wide text-[11px]">Клуб</span>
                          <select className="tg-input" name="team" value={editForm.team} onChange={handleEditChange}>
                            <option value="">— Выберите клуб —</option>
                            {LEAGUE_CLUBS[editForm.league].map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </label>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <label className="text-xs font-semibold text-tg-hint space-y-1">
                          <span className="uppercase tracking-wide text-[11px]">Размер</span>
                          <select className="tg-input" name="size" value={editForm.size} onChange={handleEditChange}>
                            <option value="">— Выберите —</option>
                            {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </label>
                        <label className="text-xs font-semibold text-tg-hint space-y-1">
                          <span className="uppercase tracking-wide text-[11px]">Сезон</span>
                          <select className="tg-input" name="season" value={editForm.season} onChange={handleEditChange}>
                            <option value="">— Выберите —</option>
                            {SEASONS.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </label>
                        <label className="text-xs font-semibold text-tg-hint space-y-1">
                          <span className="uppercase tracking-wide text-[11px]">Тип</span>
                          <select className="tg-input" name="kit_type" value={editForm.kit_type} onChange={handleEditChange}>
                            <option value="">— Выберите —</option>
                            {KIT_TYPES.map((k) => <option key={k} value={k}>{k}</option>)}
                          </select>
                        </label>
                      </div>
                      <input type="hidden" name="category_slug" value={editForm.category_slug} />
                    </>
                  )}
                  {isPosterEdit && (
                    <input type="hidden" name="category_slug" value="posters" />
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-[0.2em] text-tg-hint">Фотографии</span>
                    <span className="text-xs text-tg-hint opacity-70">
                      {editExistingImages.length + editNewImages.length} шт.
                    </span>
                  </div>
                  <div className="rounded-2xl border border-dashed border-[var(--tg-border-subtle)] bg-[var(--tg-surface-2)] p-4">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleEditFilesSelected}
                      className="w-full text-sm text-tg-hint file:mr-4 file:rounded-full file:border-0 file:bg-[var(--tg-theme-text-color)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[var(--tg-theme-bg-color)] hover:file:opacity-90"
                    />
                    <p className="mt-2 text-xs text-tg-hint opacity-70">
                      Нажмите на фото, чтобы сделать его обложкой.
                    </p>
                  </div>

                  {(editExistingImages.length > 0 || editNewImages.length > 0) && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {editExistingImages.map((src, index) => {
                        const isCover = editCover?.kind === 'existing' && editCover.index === index;
                        return (
                          <button
                            key={`existing-${index}`}
                            type="button"
                            onClick={() => setEditCover({ kind: 'existing', index })}
                            className="relative overflow-hidden rounded-2xl surface-card text-left"
                          >
                            <img src={resolveImageSrc(src)} alt={`existing-${index}`} className="h-24 w-full object-cover" />
                            {isCover && (
                              <span className="absolute left-2 top-2 rounded-full badge-contrast px-2 py-0.5 text-[10px] font-semibold">
                                Обложка
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeEditExisting(index);
                              }}
                              className="absolute right-2 top-2 rounded-full bg-[rgba(var(--tg-ink-rgb),0.55)] p-1 text-[var(--tg-theme-bg-color)] hover:bg-[rgba(var(--tg-ink-rgb),0.7)]"
                              aria-label="Удалить фото"
                            >
                              <X size={12} />
                            </button>
                          </button>
                        );
                      })}
                      {editNewImages.map((item, index) => {
                        const isCover = editCover?.kind === 'new' && editCover.index === index;
                        return (
                          <button
                            key={`new-${index}`}
                            type="button"
                            onClick={() => setEditCover({ kind: 'new', index })}
                            className="relative overflow-hidden rounded-2xl surface-card text-left"
                          >
                            <img src={item.preview} alt={`new-${index}`} className="h-24 w-full object-cover" />
                            {isCover && (
                              <span className="absolute left-2 top-2 rounded-full badge-contrast px-2 py-0.5 text-[10px] font-semibold">
                                Обложка
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeEditNew(index);
                              }}
                              className="absolute right-2 top-2 rounded-full bg-[rgba(var(--tg-ink-rgb),0.55)] p-1 text-[var(--tg-theme-bg-color)] hover:bg-[rgba(var(--tg-ink-rgb),0.7)]"
                              aria-label="Удалить фото"
                            >
                              <X size={12} />
                            </button>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleEditSubmit}
                    className={`flex-1 rounded-2xl btn-primary text-sm font-semibold ${isEditSaving ? 'opacity-70 cursor-wait' : ''}`}
                    disabled={isEditSaving}
                  >
                    {isEditSaving ? 'Сохраняем...' : 'Сохранить изменения'}
                  </button>
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="flex-1 rounded-2xl btn-secondary text-sm font-semibold"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedOrder && (
          <motion.div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedOrder(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-lg rounded-3xl surface-card p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const variant = ORDER_STATUS_VARIANTS[selectedOrder.status];
                return (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs text-tg-hint">Заказ #{selectedOrder.id}</p>
                        <h3 className="text-xl font-semibold text-tg-text">Детали заказа</h3>
                        <p className="text-sm text-tg-hint">{formatOrderMoment(selectedOrder.created_at)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(null)}
                        className="rounded-full icon-button p-2 hover:opacity-80"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl surface-soft px-4 py-3">
                      <span className="text-sm text-tg-hint">Статус</span>
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${variant.badgeClass}`}>
                        {variant.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl surface-soft px-4 py-3">
                      <span className="text-sm text-tg-hint">Сумма</span>
                      <span className="text-lg font-semibold text-tg-text">{formatPrice(selectedOrder.total_price)}</span>
                    </div>
                    <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                      {selectedOrder.items.map((item) => {
                        const product = item.product_id ? productsById.get(item.product_id) : undefined;
                        const cover = product?.gallery?.[0] || product?.image_url;
                        const imageSrc = resolveImageSrc(cover);
                        return (
                          <div
                            key={item.id}
                            className="flex gap-3 rounded-2xl surface-card p-3 shadow-sm"
                          >
                            <div className="h-20 w-20 rounded-2xl overflow-hidden bg-[var(--tg-surface-2)]">
                              <img src={imageSrc} alt={item.product_name} className="h-full w-full object-cover" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-tg-text">{item.product_name}</p>
                              <p className="text-xs text-tg-hint">{[product?.team, product?.brand, product?.league].filter(Boolean).join(' • ') || 'Без характеристик'}</p>
                              <div className="mt-2 flex items-center justify-between text-xs text-tg-hint">
                                <span>Кол-во: {item.quantity}</span>
                                <span className="font-semibold text-tg-text">
                                  {formatPrice(item.price * item.quantity)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
