import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, Copy, Download, FolderOpen, RefreshCcw, Save } from 'lucide-react';
import { ActionFeedbackCard } from '@/components/feedback/ActionFeedbackCard';
import { useActionFeedback } from '@/hooks/useActionFeedback';
import { useToastStore } from '@/store/useToastStore';
import { cn } from '@/lib/utils';

type BackupItem = {
  fileName: string;
  parsedAt?: Date;
  tag: string;
};

type DiagnosticsInfo = {
  dbPath?: string;
  dbVersion?: number;
  backups?: string[];
  features?: Record<string, boolean>;
};

function parseBackupTag(fileName: string): string {
  const idx = fileName.indexOf('pharmacy-backup-');
  if (idx <= 0) return 'unknown';
  const raw = fileName.slice(0, idx).replace(/-+$/, '').trim();
  return raw || 'manual';
}

function parseBackupDate(fileName: string): Date | undefined {
  const match = fileName.match(/pharmacy-backup-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/i);
  if (!match) return undefined;
  const iso = `${match[1]}T${match[2]}:${match[3]}:${match[4]}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function inferDesktopPath(dbPath?: string): string | null {
  if (!dbPath) return null;
  const m = dbPath.match(/^([A-Za-z]:\\Users\\[^\\]+)\\/i);
  if (!m) return null;
  return `${m[1]}\\Desktop`;
}

function defaultDiagnosticsPath(dbPath?: string): string {
  const stamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
  const desktop = inferDesktopPath(dbPath);
  if (desktop) return `${desktop}\\pharmacy-diagnostics-${stamp}.zip`;
  return `pharmacy-diagnostics-${stamp}.zip`;
}

function parentFolder(targetPath?: string): string | null {
  if (!targetPath) return null;
  const i = Math.max(targetPath.lastIndexOf('\\'), targetPath.lastIndexOf('/'));
  if (i <= 0) return null;
  return targetPath.slice(0, i);
}

function isAbsoluteWindowsPath(value: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(value);
}

export const SettingsDiagnosticsPanel: React.FC<{ appVersion?: string }> = ({ appVersion }) => {
  const showToast = useToastStore((s) => s.show);
  const { feedback, setFeedback, clearFeedback } = useActionFeedback();
  const [loading, setLoading] = useState(true);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [restoringFile, setRestoringFile] = useState<string | null>(null);
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [diag, setDiag] = useState<DiagnosticsInfo>({});
  const [updateStatus, setUpdateStatus] = useState<{ phase: string; message?: string } | null>(null);
  const [diagnosticsPathInput, setDiagnosticsPathInput] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [backupFiles, diagnostics] = await Promise.all([
        window.api?.listBackups?.(),
        window.api?.diagnostics?.(),
      ]);
      const list = (backupFiles ?? []).map((name) => ({
        fileName: name,
        parsedAt: parseBackupDate(name),
        tag: parseBackupTag(name),
      }));
      setBackups(list);
      setDiag((diagnostics ?? {}) as DiagnosticsInfo);
    } catch (error) {
      showToast(`Failed to load diagnostics: ${String(error)}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    const off = window.api?.onAutoUpdate?.((payload) => setUpdateStatus(payload));
    return () => off?.();
  }, []);

  const backupCount = diag.backups?.length ?? backups.length;
  const featurePairs = useMemo(
    () => Object.entries(diag.features ?? {}),
    [diag.features]
  );
  const backupFolderPath = useMemo(() => {
    if (!diag.dbPath) return null;
    const dbFolder = parentFolder(diag.dbPath);
    return dbFolder ? `${dbFolder}\\backups` : null;
  }, [diag.dbPath]);

  useEffect(() => {
    const suggested = defaultDiagnosticsPath(diag.dbPath);
    if (!diagnosticsPathInput) {
      setDiagnosticsPathInput(suggested);
      return;
    }
    // If current value is still a relative filename from early render, upgrade it to absolute default.
    if (!isAbsoluteWindowsPath(diagnosticsPathInput)) {
      setDiagnosticsPathInput(suggested);
    }
  }, [diag.dbPath, diagnosticsPathInput]);

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    try {
      const path = await window.api?.createBackup?.();
      showToast('Backup created successfully.', 'success');
      if (path) {
        setFeedback({
          type: 'success',
          title: 'Backup created',
          description: 'A fresh backup snapshot was created successfully.',
          meta: path,
          actions: [
            {
              label: 'Open Folder',
              variant: 'primary',
              onClick: () => void handleOpenPath(backupFolderPath, 'Opened backup folder.'),
            },
          ],
        });
      }
      await loadAll();
    } catch (error) {
      showToast(`Backup failed: ${String(error)}`, 'error');
      setFeedback({
        type: 'error',
        title: 'Backup failed',
        description: String(error),
      });
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleRestore = async (fileName: string) => {
    const ok = window.confirm(
      `Restore backup "${fileName}"?\n\nThis will overwrite current data. This action cannot be undone.`
    );
    if (!ok) return;
    setRestoringFile(fileName);
    try {
      await window.api?.restoreBackup?.(fileName);
      showToast('Backup restored. The app will reload data now.', 'success');
      setFeedback({
        type: 'info',
        title: 'Backup restored',
        description: `Restored from ${fileName}.`,
        actions: [
          {
            label: 'Open Folder',
            onClick: () => void handleOpenPath(backupFolderPath, 'Opened backup folder.'),
            variant: 'secondary',
          },
        ],
      });
      await loadAll();
    } catch (error) {
      showToast(`Restore failed: ${String(error)}`, 'error');
      setFeedback({
        type: 'error',
        title: 'Restore failed',
        description: String(error),
      });
    } finally {
      setRestoringFile(null);
    }
  };

  const handleExportDiagnostics = async () => {
    setExporting(true);
    try {
      const chosen = diagnosticsPathInput.trim();
      if (!chosen) {
        showToast('Please enter a diagnostics export path.', 'error');
        setExporting(false);
        return;
      }
      const out = await window.api?.exportDiagnostics?.(chosen);
      if (out) {
        const outFolder = parentFolder(out);
        setFeedback({
          type: 'success',
          title: 'Diagnostics exported',
          description: 'Support package was created successfully.',
          meta: out,
          actions: [
            {
              label: 'Open File Location',
              variant: 'primary',
              onClick: () => void handleOpenPath(outFolder, 'Opened diagnostics folder.'),
            },
          ],
        });
      }
      showToast('Diagnostics exported successfully.', 'success');
    } catch (error) {
      showToast(`Diagnostics export failed: ${String(error)}`, 'error');
      setFeedback({
        type: 'error',
        title: 'Diagnostics export failed',
        description: String(error),
      });
    } finally {
      setExporting(false);
    }
  };

  const handleOpenPath = async (targetPath: string | null, successLabel: string) => {
    if (!targetPath) return;
    try {
      await window.api?.openPath?.(targetPath);
      showToast(successLabel, 'success');
    } catch (error) {
      showToast(`Could not open path: ${String(error)}`, 'error');
    }
  };

  const handleCopyPath = async (targetPath: string | null) => {
    if (!targetPath) return;
    try {
      await navigator.clipboard.writeText(targetPath);
      showToast('Path copied to clipboard.', 'success');
    } catch (error) {
      showToast(`Copy failed: ${String(error)}`, 'error');
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-[18px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_8px_30px_-18px_rgba(15,23,42,0.18)] dark:border-zinc-800/90 dark:bg-zinc-900/70 dark:shadow-black/30">
        <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">System Diagnostics &amp; Support</h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
          Backup, restore, and support tools for non-technical staff.
        </p>

        {updateStatus?.message ? (
          <div
            className={cn(
              'mt-4 rounded-2xl border px-3 py-2 text-xs font-medium',
              updateStatus.phase === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-100'
                : 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/40 dark:bg-sky-950/40 dark:text-sky-100'
            )}
          >
            {updateStatus.message}
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500">App version</p>
            <p className="mt-1 font-mono text-xs font-semibold text-slate-900 dark:text-white">{appVersion ?? 'unknown'}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500">DB version</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{diag.dbVersion ?? 'unknown'}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500">Backup count</p>
            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{backupCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500">Health</p>
            <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-300">Operational</p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={creatingBackup || loading || restoringFile !== null}
            onClick={handleCreateBackup}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900"
          >
            <Save className="h-4 w-4" />
            {creatingBackup ? 'Creating backup...' : 'Create Backup Now'}
          </button>
          <button
            type="button"
            disabled={exporting || loading}
            onClick={handleExportDiagnostics}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          >
            <Download className="h-4 w-4" />
            {exporting ? 'Exporting...' : 'Export Diagnostics'}
          </button>
        </div>
        <div className="mt-3">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-500">
              Diagnostics ZIP path
            </span>
            <input
              value={diagnosticsPathInput}
              onChange={(e) => setDiagnosticsPathInput(e.target.value)}
              placeholder={defaultDiagnosticsPath(diag.dbPath)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-mono text-slate-800 shadow-sm transition focus:border-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:focus:border-sky-500 dark:focus:ring-sky-900/30"
            />
          </label>
          <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-500">
            Default saves to Desktop. You can edit this path before exporting.
          </p>
        </div>

        {feedback ? (
          <div className="mt-2">
            <ActionFeedbackCard
              title={feedback.title}
              description={feedback.description}
              type={feedback.type}
              actions={[
                ...(feedback.actions ?? []),
                ...(feedback.meta
                  ? [
                      {
                        label: 'Copy Path',
                        variant: 'secondary' as const,
                        onClick: () => void handleCopyPath(feedback.meta ?? null),
                      },
                    ]
                  : []),
                {
                  label: 'Dismiss',
                  variant: 'secondary',
                  onClick: clearFeedback,
                },
              ]}
              meta={feedback.meta}
            />
          </div>
        ) : null}

        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Restoring a backup overwrites current data. Always create a fresh backup before restoring.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-[18px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_8px_30px_-18px_rgba(15,23,42,0.18)] dark:border-zinc-800/90 dark:bg-zinc-900/70 dark:shadow-black/30">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">Backups</h4>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">Available backup snapshots on this device.</p>
          </div>
          <button
            type="button"
            onClick={() => void loadAll()}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>

        <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-100 dark:border-zinc-800">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-3 py-2 font-semibold">File</th>
                <th className="px-3 py-2 font-semibold">Date</th>
                <th className="px-3 py-2 font-semibold">Tag</th>
                <th className="px-3 py-2 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-slate-500 dark:text-zinc-400">
                    Loading backups...
                  </td>
                </tr>
              ) : backups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-slate-500 dark:text-zinc-400">
                    No backups found.
                  </td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.fileName} className="border-t border-slate-100 dark:border-zinc-800">
                    <td className="px-3 py-2 font-mono text-[11px] text-slate-700 dark:text-zinc-300">{b.fileName}</td>
                    <td className="px-3 py-2 text-slate-600 dark:text-zinc-400">
                      {b.parsedAt ? format(b.parsedAt, 'MMM d, yyyy HH:mm') : 'Unknown'}
                    </td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {b.tag}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => void handleRestore(b.fileName)}
                        disabled={restoringFile !== null || creatingBackup || exporting}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-800 disabled:opacity-60 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200"
                      >
                        {restoringFile === b.fileName ? 'Restoring...' : 'Restore'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleOpenPath(backupFolderPath, 'Opened backup folder.')}
            disabled={!backupFolderPath}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Open Backup Folder
          </button>
          <button
            type="button"
            onClick={() => void handleCopyPath(backupFolderPath)}
            disabled={!backupFolderPath}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy Backup Folder Path
          </button>
        </div>
      </div>

      <div className="rounded-[18px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_8px_30px_-18px_rgba(15,23,42,0.18)] dark:border-zinc-800/90 dark:bg-zinc-900/70 dark:shadow-black/30">
        <h4 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">System health details</h4>
        <div className="mt-3 space-y-2 text-xs text-slate-600 dark:text-zinc-400">
          <p><span className="font-semibold text-slate-800 dark:text-zinc-200">DB Path:</span> {diag.dbPath ?? 'Unavailable'}</p>
          <p><span className="font-semibold text-slate-800 dark:text-zinc-200">DB Version:</span> {diag.dbVersion ?? 'Unavailable'}</p>
          <p><span className="font-semibold text-slate-800 dark:text-zinc-200">Backup count:</span> {backupCount}</p>
          <div>
            <p className="font-semibold text-slate-800 dark:text-zinc-200">Feature flags:</p>
            {featurePairs.length === 0 ? (
              <p className="mt-1 text-slate-500 dark:text-zinc-500">Unavailable in this build.</p>
            ) : (
              <ul className="mt-1 grid gap-1 sm:grid-cols-2">
                {featurePairs.map(([name, enabled]) => (
                  <li key={name} className="rounded-lg border border-slate-100 px-2 py-1 dark:border-zinc-800">
                    <span className="font-mono">{name}</span>: {enabled ? 'enabled' : 'disabled'}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-[18px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_8px_30px_-18px_rgba(15,23,42,0.18)] dark:border-zinc-800/90 dark:bg-zinc-900/70 dark:shadow-black/30">
        <h4 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">Error log preview</h4>
        <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
          Preview is not available in this build. Use <span className="font-semibold">Export Diagnostics</span> and share the ZIP with support.
        </p>
      </div>
    </div>
  );
};
