import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  Columns,
  ArrowUpDown,
  Check,
  X,
  Edit2,
} from 'lucide-react';
import type { CrudFieldLookMetadata, CrudResourceMetadata } from '../../../shared/types.ts';
import { apiRawRequest, apiRequest, exportRowsToCsv } from '../../lib/api.ts';
import { useApp } from '../../context/AppContext.tsx';
import { formatMoney, formatRelativeDate, pickI18n, t } from '../../i18n/dictionary.ts';

interface AdvancedDataTableProps {
  resource: string;
  initialStatusFilter?: string;
  refreshTrigger?: number;
  headerActions?: React.ReactNode;
}

interface CrudListResponse {
  success: boolean;
  meta: { resource: string; tenant_id: string; execution_ms: number };
  pagination: {
    mode: string;
    limit: number;
    current_page: number;
    total_items: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
  data: Record<string, unknown>[];
}

export const AdvancedDataTable: React.FC<AdvancedDataTableProps> = ({
  resource,
  initialStatusFilter = 'all',
  refreshTrigger = 0,
  headerActions,
}) => {
  const { locale, notify } = useApp();
  const [schema, setSchema] = useState<CrudResourceMetadata | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [pagination, setPagination] = useState({
    limit: 10,
    current_page: 1,
    total_items: 0,
    total_pages: 1,
    has_next: false,
    has_prev: false,
  });
  const [execMs, setExecMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [sortBy, setSortBy] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [hiddenCols, setHiddenCols] = useState<Record<string, boolean>>({});
  const [showColMenu, setShowColMenu] = useState(false);

  // Inline edit state
  const [editingCell, setEditingCell] = useState<{ rowId: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // 300ms debounce for search
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
    setStatusFilter(initialStatusFilter);
    apiRequest<CrudResourceMetadata>(`/crud/${resource}/schema`)
      .then((res) => {
        setSchema(res);
        setSortBy(res.default_sort.field);
        setSortOrder(res.default_sort.order);
      })
      .catch((err) => notify(err.message, 'error'));
  }, [resource, initialStatusFilter, notify]);

  const fetchRows = useCallback(async () => {
    if (!schema) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        search: debouncedSearch,
        status: statusFilter,
        sort_by: sortBy || schema.default_sort.field,
        sort_order: sortOrder,
      });
      const res = await apiRawRequest<CrudListResponse>(`/crud/${resource}?${qs.toString()}`);
      setRows(res.data || []);
      setPagination(res.pagination);
      setExecMs(res.meta?.execution_ms ?? null);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to load table data', 'error');
    } finally {
      setLoading(false);
    }
  }, [schema, resource, page, limit, debouncedSearch, statusFilter, sortBy, sortOrder, notify]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows, refreshTrigger]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const commitInlineEdit = async (rowId: string, field: string, value: unknown) => {
    try {
      await apiRequest(`/crud/${resource}/${rowId}/inline`, {
        method: 'PATCH',
        body: JSON.stringify({ field, value }),
      });
      setEditingCell(null);
      notify(locale === 'ar' ? 'تم تحديث السجل بنجاح' : 'Record updated', 'success');
      fetchRows();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Update failed', 'error');
    }
  };

  const renderCellValue = (row: Record<string, unknown>, fieldMeta: CrudFieldLookMetadata) => {
    const raw = row[fieldMeta.field];
    const rowId = String(row[schema?.primary_key || 'id']);
    const isEditing = editingCell?.rowId === rowId && editingCell?.field === fieldMeta.field;

    if (fieldMeta.look_type === 'boolean_switch') {
      const checked = Boolean(raw);
      return (
        <button
          type="button"
          disabled={!fieldMeta.inline_edit.enabled}
          onClick={() => commitInlineEdit(rowId, fieldMeta.field, !checked)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            checked ? 'bg-[var(--brand-primary)]' : 'bg-zinc-300 dark:bg-zinc-700'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
              checked ? 'translate-x-4 rtl:-translate-x-4' : 'translate-x-1 rtl:-translate-x-1'
            }`}
          />
        </button>
      );
    }

    if (isEditing && fieldMeta.inline_edit.enabled) {
      if (fieldMeta.inline_edit.input_type === 'select' && fieldMeta.inline_edit.options) {
        return (
          <div className="flex items-center gap-1">
            <select
              value={editValue}
              onChange={(e) => commitInlineEdit(rowId, fieldMeta.field, e.target.value)}
              className="rounded border border-[var(--brand-primary)] bg-[var(--surface-canvas)] px-2 py-1 text-xs"
            >
              {fieldMeta.inline_edit.options.map((opt) => (
                <option key={opt} value={opt}>
                  {t(locale, opt)}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => setEditingCell(null)} className="p-1 text-[var(--text-secondary)]">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      }

      return (
        <div className="flex items-center gap-1">
          <input
            type={fieldMeta.inline_edit.input_type === 'number' ? 'number' : 'text'}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitInlineEdit(rowId, fieldMeta.field, editValue);
              if (e.key === 'Escape') setEditingCell(null);
            }}
            className="w-28 rounded border border-[var(--brand-primary)] bg-[var(--surface-canvas)] px-2 py-1 text-xs tabular-nums"
            autoFocus
          />
          <button
            type="button"
            onClick={() => commitInlineEdit(rowId, fieldMeta.field, editValue)}
            className="p-1 text-emerald-600"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => setEditingCell(null)} className="p-1 text-red-500">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      );
    }

    const startEdit = () => {
      if (!fieldMeta.inline_edit.enabled) return;
      const initialStr =
        raw && typeof raw === 'object' && ('ar' in (raw as object) || 'en' in (raw as object))
          ? pickI18n(raw as { ar: string; en: string }, locale)
          : String(raw ?? '');
      setEditValue(initialStr);
      setEditingCell({ rowId, field: fieldMeta.field });
    };

    if (fieldMeta.look_type === 'badge') {
      const valStr = String(raw ?? '');
      const rule = fieldMeta.display_options.badge_map?.find((b) => b.value === valStr);
      const toneClass =
        rule?.variant === 'success'
          ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800'
          : rule?.variant === 'warning'
            ? 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/40 dark:border-amber-800'
            : rule?.variant === 'danger'
              ? 'text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/40 dark:border-red-800'
              : rule?.variant === 'info'
                ? 'text-sky-700 bg-sky-50 border-sky-200 dark:text-sky-300 dark:bg-sky-950/40 dark:border-sky-800'
                : 'text-[var(--text-secondary)] bg-[var(--surface-muted)] border-[var(--border-hairline)]';

      return (
        <button
          type="button"
          onClick={startEdit}
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${toneClass} ${
            fieldMeta.inline_edit.enabled ? 'cursor-pointer hover:opacity-85' : 'cursor-default'
          }`}
        >
          {t(locale, rule?.label_key || valStr)}
          {fieldMeta.inline_edit.enabled && <Edit2 className="h-2.5 w-2.5 opacity-55" />}
        </button>
      );
    }

    if (fieldMeta.look_type === 'currency') {
      const currency = String(row[fieldMeta.display_options.currency_field || 'currency'] || 'SAR');
      return (
        <span
          onClick={startEdit}
          className={`tabular-nums font-semibold text-[var(--text-primary)] ${
            fieldMeta.inline_edit.enabled ? 'cursor-pointer hover:underline decoration-dotted' : ''
          }`}
        >
          {formatMoney(Number(raw || 0), currency, locale)}
        </span>
      );
    }

    if (fieldMeta.look_type === 'date_relative') {
      return (
        <span className="tabular-nums text-xs text-[var(--text-secondary)]">
          {raw ? formatRelativeDate(String(raw), locale) : '—'}
        </span>
      );
    }

    const displayText =
      raw && typeof raw === 'object' && ('ar' in (raw as object) || 'en' in (raw as object))
        ? pickI18n(raw as { ar: string; en: string }, locale)
        : raw !== null && raw !== undefined && raw !== ''
          ? String(raw)
          : '—';

    return (
      <span
        onClick={startEdit}
        className={`text-sm text-[var(--text-primary)] ${
          fieldMeta.inline_edit.enabled ? 'cursor-pointer hover:underline decoration-dotted' : ''
        } ${typeof raw === 'number' ? 'tabular-nums font-medium' : ''}`}
      >
        {displayText}
      </span>
    );
  };

  if (!schema) {
    return (
      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] p-8 text-center text-sm text-[var(--text-secondary)]">
        {locale === 'ar' ? 'جاري تحميل الجدول...' : 'Loading data table...'}
      </div>
    );
  }

  const visibleFields = schema.fields.filter((f) => !hiddenCols[f.field]);
  const statusField = schema.fields.find(
    (f) => f.look_type === 'badge' && f.capabilities.filterable && f.display_options.badge_map
  );

  const handleExportCsv = () => {
    const headers = visibleFields.map((f) => t(locale, f.label_key));
    const exportData = rows.map((r) =>
      visibleFields.map((f) => {
        const val = r[f.field];
        if (val && typeof val === 'object' && ('ar' in (val as object) || 'en' in (val as object))) {
          return pickI18n(val as { ar: string; en: string }, locale);
        }
        return val as string | number | boolean | null;
      })
    );
    exportRowsToCsv(`${resource}-${new Date().toISOString().slice(0, 10)}.csv`, headers, exportData);
  };

  return (
    <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-card)] overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[var(--border-hairline)] p-4 no-print">
        <div>
          <h2 className="text-base font-bold text-[var(--text-primary)]">
            {pickI18n(schema.title_i18n, locale)}
          </h2>
          <p className="text-xs text-[var(--text-secondary)] tabular-nums">
            {pagination.total_items} {locale === 'ar' ? 'سجل' : 'records'}
            {execMs !== null ? ` · ${execMs}ms` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {headerActions}

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-2.5 h-3.5 w-3.5 text-[var(--text-secondary)]" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={locale === 'ar' ? 'بحث سريع...' : 'Quick search...'}
              className="w-44 sm:w-56 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] ps-8 pe-3 py-1.5 text-xs text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none"
            />
          </div>

          {statusField && (
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-2.5 py-1.5 text-xs text-[var(--text-primary)]"
            >
              <option value="all">{locale === 'ar' ? 'كل الحالات' : 'All Statuses'}</option>
              {statusField.display_options.badge_map?.map((b) => (
                <option key={b.value} value={b.value}>
                  {t(locale, b.label_key)}
                </option>
              ))}
            </select>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowColMenu((s) => !s)}
              className="flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
            >
              <Columns className="h-3.5 w-3.5" />
              {t(locale, 'columns')}
            </button>
            {showColMenu && (
              <div className="absolute end-0 z-20 mt-1 w-48 rounded-lg border border-[var(--border-hairline)] bg-[var(--surface-card)] p-2 shadow-lg space-y-1">
                {schema.fields.map((f) => (
                  <label key={f.field} className="flex items-center gap-2 px-2 py-1 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!hiddenCols[f.field]}
                      disabled={!f.capabilities.user_toggleable}
                      onChange={() =>
                        setHiddenCols((prev) => ({ ...prev, [f.field]: !prev[f.field] }))
                      }
                    />
                    <span>{t(locale, f.label_key)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
          >
            <Download className="h-3.5 w-3.5" />
            {t(locale, 'export_csv')}
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
          >
            <Printer className="h-3.5 w-3.5" />
            {t(locale, 'print_view')}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-start border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-hairline)] bg-[var(--surface-muted)]/60">
              {visibleFields.map((f) => (
                <th
                  key={f.field}
                  className="px-4 py-3 text-start text-xs font-semibold text-[var(--text-secondary)] whitespace-nowrap"
                >
                  {f.capabilities.sortable ? (
                    <button
                      type="button"
                      onClick={() => handleSort(f.field)}
                      className="inline-flex items-center gap-1 hover:text-[var(--text-primary)]"
                    >
                      <span>{t(locale, f.label_key)}</span>
                      <ArrowUpDown className="h-3 w-3 opacity-60" />
                    </button>
                  ) : (
                    t(locale, f.label_key)
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-hairline)]">
            {loading ? (
              <tr>
                <td colSpan={visibleFields.length} className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
                  {locale === 'ar' ? 'جاري التحديث...' : 'Refreshing...'}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={visibleFields.length} className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">
                  {t(locale, 'no_records')}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={String(row[schema.primary_key])} className="hover:bg-[var(--surface-muted)]/40 transition-colors">
                  {visibleFields.map((f) => (
                    <td key={f.field} className="px-4 py-3 text-start whitespace-nowrap">
                      {renderCellValue(row, f)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-[var(--border-hairline)] px-4 py-3 text-xs text-[var(--text-secondary)] no-print">
        <div className="flex items-center gap-2">
          <span>{t(locale, 'rows_per_page')}:</span>
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
            className="rounded border border-[var(--border-hairline)] bg-[var(--surface-canvas)] px-2 py-1 text-xs tabular-nums"
          >
            {[5, 10, 25, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span className="tabular-nums">
            {pagination.current_page} / {pagination.total_pages}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={!pagination.has_prev}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] px-2.5 py-1 hover:bg-[var(--surface-muted)] disabled:opacity-40"
            >
              {locale === 'ar' ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
              {t(locale, 'prev_page')}
            </button>
            <button
              type="button"
              disabled={!pagination.has_next}
              onClick={() => setPage((p) => p + 1)}
              className="flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] px-2.5 py-1 hover:bg-[var(--surface-muted)] disabled:opacity-40"
            >
              {t(locale, 'next_page')}
              {locale === 'ar' ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
