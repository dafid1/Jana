import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Delete, History, FlaskConical, Sun, Moon, Trash2, Calculator } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import {
  DEFAULT_CALCULATOR_PIN,
  CalculatorLockPublicConfig,
  getCachedCalculatorLock,
  setCachedCalculatorLock,
  fetchLatestCalculatorLock,
  verifyCalculatorPin,
} from '../../utils/calculatorLock';

interface CalculatorVaultProps {
  onUnlock: (code: string) => void;
}

interface HistoryEntry {
  id: string;
  expression: string;
  result: string;
  timestamp: string;
}

type Operator = '+' | '-' | '×' | '÷' | '^' | null;

const HISTORY_STORAGE_KEY = 'calc_history_entries_v1';
const CALC_THEME_KEY = 'calc_theme_mode_v1';

function formatResultNumber(num: number): string {
  if (!Number.isFinite(num)) return 'خطأ';
  if (Object.is(num, -0)) return '0';
  // Clean floating point artifacts like 0.1 + 0.2 = 0.30000000000000004
  const rounded = Number(num.toPrecision(12));
  const str = String(rounded);
  if (str.length > 14) {
    return num.toExponential(6).replace(/\.?0+e/, 'e');
  }
  return str;
}

function formatDisplayWithCommas(val: string): string {
  if (val === 'خطأ' || val === 'NaN' || val === 'Infinity' || val === '-Infinity') {
    return 'خطأ';
  }
  if (val.includes('e') || val.includes('E')) return val;
  const isNeg = val.startsWith('-');
  const unsigned = isNeg ? val.slice(1) : val;
  const [intPart, decPart] = unsigned.split('.');
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const prefix = isNeg ? '-' : '';
  return decPart !== undefined ? `${prefix}${formattedInt}.${decPart}` : `${prefix}${formattedInt}`;
}

function computeBinary(a: number, b: number, op: Operator): number {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '×':
      return a * b;
    case '÷':
      return b === 0 ? NaN : a / b;
    case '^':
      return Math.pow(a, b);
    default:
      return b;
  }
}

export const CalculatorVault: React.FC<CalculatorVaultProps> = ({ onUnlock }) => {
  const [calcTheme, setCalcTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem(CALC_THEME_KEY) as 'dark' | 'light') || 'dark';
  });
  const [scientificMode, setScientificMode] = useState(false);
  const [showMobileHistory, setShowMobileHistory] = useState(false);
  const [isDegree, setIsDegree] = useState(true);

  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [justEvaluated, setJustEvaluated] = useState(false);
  const [lastRepeatOp, setLastRepeatOp] = useState<{ op: Operator; operand: number } | null>(null);
  const [isTypedInput, setIsTypedInput] = useState(false);

  const [lockConfig, setLockConfig] = useState<CalculatorLockPublicConfig | null>(() =>
    getCachedCalculatorLock()
  );
  const serverSyncedRef = useRef(false);
  const verifyingPinRef = useRef(false);

  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as HistoryEntry[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    let active = true;
    fetchLatestCalculatorLock().then((cfg) => {
      if (active) {
        setLockConfig(cfg);
        serverSyncedRef.current = true;
      }
    });

    const unsub = onSnapshot(
      doc(db, 'appConfig', 'calculatorLock'),
      (snap) => {
        if (!active) return;
        serverSyncedRef.current = true;
        if (snap.exists()) {
          const data = snap.data() as CalculatorLockPublicConfig;
          setCachedCalculatorLock(data);
          setLockConfig(data);
        } else {
          setCachedCalculatorLock(null);
          setLockConfig(null);
        }
      },
      () => {
        // Ignore transient offline listener errors; cached lock remains active
      }
    );

    return () => {
      active = false;
      unsub();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(CALC_THEME_KEY, calcTheme);
  }, [calcTheme]);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 30)));
    } catch {
      // Ignore storage quota issues
    }
  }, [history]);

  const resetAll = useCallback(() => {
    setDisplay('0');
    setExpression('');
    setPreviousValue(null);
    setOperator(null);
    setWaitingForOperand(false);
    setJustEvaluated(false);
    setLastRepeatOp(null);
    setIsTypedInput(false);
  }, []);

  const triggerUnlockCleanly = useCallback(
    (verifiedCode: string) => {
      resetAll();
      onUnlock(verifiedCode);
    },
    [onUnlock, resetAll]
  );

  const checkSecretPinAttempt = useCallback(
    async (candidate: string) => {
      if (verifyingPinRef.current) return false;
      verifyingPinRef.current = true;
      try {
        const res = await verifyCalculatorPin(
          candidate,
          serverSyncedRef.current ? lockConfig : undefined
        );
        if (res.matched) {
          triggerUnlockCleanly(candidate);
          return true;
        }
        return false;
      } finally {
        verifyingPinRef.current = false;
      }
    },
    [lockConfig, triggerUnlockCleanly]
  );

  const pushHistory = useCallback((expr: string, res: string) => {
    if (res === 'خطأ') return;
    const entry: HistoryEntry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      expression: expr,
      result: res,
      timestamp: new Date().toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    setHistory((prev) => [entry, ...prev].slice(0, 30));
  }, []);

  const expectedPinLength = lockConfig?.pinLength || DEFAULT_CALCULATOR_PIN.length;

  const inputDigit = useCallback(
    (digit: string) => {
      if (display === 'خطأ') {
        setDisplay(digit);
        setExpression('');
        setPreviousValue(null);
        setOperator(null);
        setWaitingForOperand(false);
        setJustEvaluated(false);
        setIsTypedInput(true);
        return;
      }

      if (waitingForOperand || justEvaluated) {
        const next = digit;
        if (justEvaluated) {
          setExpression('');
          setPreviousValue(null);
          setOperator(null);
          setLastRepeatOp(null);
        }
        setDisplay(next);
        setWaitingForOperand(false);
        setJustEvaluated(false);
        setIsTypedInput(true);
        return;
      }

      if (display.replace('-', '').replace('.', '').length >= 13) return;

      const next = display === '0' ? digit : display === '-0' ? `-${digit}` : `${display}${digit}`;
      setDisplay(next);
      setIsTypedInput(true);

      // Verify secret access code on exact active PIN length
      if (/^\d{4,12}$/.test(next) && next.length === expectedPinLength) {
        void checkSecretPinAttempt(next);
      }
    },
    [display, waitingForOperand, justEvaluated, expectedPinLength, checkSecretPinAttempt]
  );

  const inputDecimal = useCallback(() => {
    if (display === 'خطأ') {
      setDisplay('0.');
      setExpression('');
      setWaitingForOperand(false);
      setJustEvaluated(false);
      setIsTypedInput(true);
      return;
    }
    if (waitingForOperand || justEvaluated) {
      if (justEvaluated) {
        setExpression('');
        setPreviousValue(null);
        setOperator(null);
      }
      setDisplay('0.');
      setWaitingForOperand(false);
      setJustEvaluated(false);
      setIsTypedInput(true);
      return;
    }
    if (!display.includes('.')) {
      setDisplay(`${display}.`);
      setIsTypedInput(true);
    }
  }, [display, waitingForOperand, justEvaluated]);

  const handleBackspace = useCallback(() => {
    if (display === 'خطأ' || justEvaluated || waitingForOperand) {
      setDisplay('0');
      setWaitingForOperand(false);
      setJustEvaluated(false);
      setIsTypedInput(false);
      return;
    }
    if (display.length <= 1 || (display.length === 2 && display.startsWith('-'))) {
      setDisplay('0');
      setIsTypedInput(false);
    } else {
      setDisplay(display.slice(0, -1));
    }
  }, [display, justEvaluated, waitingForOperand]);

  const handleClear = useCallback(() => {
    const canClearEntry = display !== '0' && !justEvaluated && !waitingForOperand && previousValue !== null;
    if (canClearEntry) {
      setDisplay('0');
      setIsTypedInput(false);
    } else {
      resetAll();
    }
  }, [display, justEvaluated, waitingForOperand, previousValue, resetAll]);

  const handleToggleSign = useCallback(() => {
    if (display === 'خطأ' || display === '0') return;
    setDisplay(display.startsWith('-') ? display.slice(1) : `-${display}`);
  }, [display]);

  const handlePercent = useCallback(() => {
    if (display === 'خطأ') return;
    const current = parseFloat(display);
    if (Number.isNaN(current)) return;

    let resultVal: number;
    if (previousValue !== null && (operator === '+' || operator === '-')) {
      resultVal = (previousValue * current) / 100;
    } else {
      resultVal = current / 100;
    }
    setDisplay(formatResultNumber(resultVal));
    setIsTypedInput(false);
  }, [display, previousValue, operator]);

  const handleOperator = useCallback(
    (nextOp: Exclude<Operator, null>) => {
      if (display === 'خطأ') return;
      const inputValue = parseFloat(display);
      if (Number.isNaN(inputValue)) return;

      if (previousValue !== null && operator && !waitingForOperand && !justEvaluated) {
        const result = computeBinary(previousValue, inputValue, operator);
        const formatted = formatResultNumber(result);
        if (formatted === 'خطأ') {
          setDisplay('خطأ');
          setExpression('');
          setPreviousValue(null);
          setOperator(null);
          setWaitingForOperand(false);
          setIsTypedInput(false);
          return;
        }
        setDisplay(formatted);
        setPreviousValue(result);
        setExpression(`${formatted} ${nextOp}`);
      } else {
        setPreviousValue(inputValue);
        setExpression(`${formatResultNumber(inputValue)} ${nextOp}`);
      }

      setOperator(nextOp);
      setWaitingForOperand(true);
      setJustEvaluated(false);
      setLastRepeatOp(null);
      setIsTypedInput(false);
    },
    [display, previousValue, operator, waitingForOperand, justEvaluated]
  );

  const handleEquals = useCallback(async () => {
    if (isTypedInput && /^\d{4,12}$/.test(display)) {
      const unlocked = await checkSecretPinAttempt(display);
      if (unlocked) return;
    }

    if (display === 'خطأ') return;
    const currentVal = parseFloat(display);
    if (Number.isNaN(currentVal)) return;

    if (operator && previousValue !== null) {
      const result = computeBinary(previousValue, currentVal, operator);
      const formatted = formatResultNumber(result);
      const exprText = `${formatResultNumber(previousValue)} ${operator} ${formatResultNumber(currentVal)}`;
      setExpression(`${exprText} =`);
      setDisplay(formatted);
      pushHistory(exprText, formatted);
      setLastRepeatOp({ op: operator, operand: currentVal });
      setPreviousValue(null);
      setOperator(null);
      setWaitingForOperand(false);
      setJustEvaluated(true);
      setIsTypedInput(false);
      return;
    }

    if (justEvaluated && lastRepeatOp && lastRepeatOp.op) {
      const result = computeBinary(currentVal, lastRepeatOp.operand, lastRepeatOp.op);
      const formatted = formatResultNumber(result);
      const exprText = `${formatResultNumber(currentVal)} ${lastRepeatOp.op} ${formatResultNumber(
        lastRepeatOp.operand
      )}`;
      setExpression(`${exprText} =`);
      setDisplay(formatted);
      pushHistory(exprText, formatted);
      setIsTypedInput(false);
    }
  }, [
    isTypedInput,
    display,
    checkSecretPinAttempt,
    operator,
    previousValue,
    justEvaluated,
    lastRepeatOp,
    pushHistory,
  ]);

  const applyScientificUnary = useCallback(
    (fn: 'sin' | 'cos' | 'tan' | 'sqrt' | 'sq' | 'ln' | 'log' | 'inv') => {
      if (display === 'خطأ') return;
      const val = parseFloat(display);
      if (Number.isNaN(val)) return;

      const rad = isDegree ? (val * Math.PI) / 180 : val;
      let res = NaN;
      let label = '';

      switch (fn) {
        case 'sin':
          res = Math.abs(Math.sin(rad)) < 1e-12 ? 0 : Math.sin(rad);
          label = `sin(${formatResultNumber(val)})`;
          break;
        case 'cos':
          res = Math.abs(Math.cos(rad)) < 1e-12 ? 0 : Math.cos(rad);
          label = `cos(${formatResultNumber(val)})`;
          break;
        case 'tan': {
          const cosVal = Math.cos(rad);
          res = Math.abs(cosVal) < 1e-12 ? NaN : Math.tan(rad);
          label = `tan(${formatResultNumber(val)})`;
          break;
        }
        case 'sqrt':
          res = val < 0 ? NaN : Math.sqrt(val);
          label = `√(${formatResultNumber(val)})`;
          break;
        case 'sq':
          res = val * val;
          label = `(${formatResultNumber(val)})²`;
          break;
        case 'ln':
          res = val <= 0 ? NaN : Math.log(val);
          label = `ln(${formatResultNumber(val)})`;
          break;
        case 'log':
          res = val <= 0 ? NaN : Math.log10(val);
          label = `log(${formatResultNumber(val)})`;
          break;
        case 'inv':
          res = val === 0 ? NaN : 1 / val;
          label = `1/(${formatResultNumber(val)})`;
          break;
      }

      const formatted = formatResultNumber(res);
      setExpression(`${label} =`);
      setDisplay(formatted);
      setJustEvaluated(true);
      setWaitingForOperand(false);
      setIsTypedInput(false);
      pushHistory(label, formatted);
    },
    [display, isDegree, pushHistory]
  );

  const insertConstant = useCallback((c: 'pi' | 'e') => {
    const val = c === 'pi' ? Math.PI : Math.E;
    setDisplay(formatResultNumber(val));
    setWaitingForOperand(false);
    setJustEvaluated(false);
    setIsTypedInput(false);
  }, []);

  // Physical keyboard support
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key;
      if (/^[0-9]$/.test(key)) {
        e.preventDefault();
        inputDigit(key);
      } else if (key === '.' || key === ',') {
        e.preventDefault();
        inputDecimal();
      } else if (key === '+') {
        e.preventDefault();
        handleOperator('+');
      } else if (key === '-') {
        e.preventDefault();
        handleOperator('-');
      } else if (key === '*') {
        e.preventDefault();
        handleOperator('×');
      } else if (key === '/') {
        e.preventDefault();
        handleOperator('÷');
      } else if (key === '%') {
        e.preventDefault();
        handlePercent();
      } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        handleEquals();
      } else if (key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (key === 'Escape' || key === 'Delete') {
        e.preventDefault();
        resetAll();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    inputDigit,
    inputDecimal,
    handleOperator,
    handlePercent,
    handleEquals,
    handleBackspace,
    resetAll,
  ]);

  const isDark = calcTheme === 'dark';
  const clearLabel =
    display !== '0' && !justEvaluated && !waitingForOperand && previousValue !== null ? 'C' : 'AC';

  const formattedDisplay = formatDisplayWithCommas(display);
  const displayFontSizeClass =
    formattedDisplay.length > 13
      ? 'text-3xl sm:text-4xl'
      : formattedDisplay.length > 9
      ? 'text-4xl sm:text-5xl'
      : 'text-5xl sm:text-6xl';

  const numBtnClass = isDark
    ? 'bg-[#1f1f24] hover:bg-[#2a2a31] active:bg-[#34343c] text-white border border-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_2px_6px_rgba(0,0,0,0.35)]'
    : 'bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-900 border border-slate-200/90 shadow-xs';

  const fnBtnClass = isDark
    ? 'bg-[#2f2f37] hover:bg-[#3c3c46] active:bg-[#494954] text-slate-100 border border-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
    : 'bg-slate-200/85 hover:bg-slate-300/85 active:bg-slate-300 text-slate-800 border border-slate-300/60';

  const opBtnClass = (op: Operator) => {
    const isActive = operator === op && waitingForOperand;
    if (isActive) {
      return isDark
        ? 'bg-white text-[#d97706] shadow-inner border border-amber-200'
        : 'bg-slate-900 text-amber-400 shadow-inner border border-slate-800';
    }
    return 'bg-[#f59e0b] hover:bg-[#e69107] active:bg-[#d97706] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_4px_12px_rgba(245,158,11,0.25)]';
  };

  const sciBtnClass = isDark
    ? 'bg-[#17171c] hover:bg-[#23232a] active:bg-[#2d2d35] text-slate-200 border border-white/[0.06]'
    : 'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 border border-slate-200/90';

  return (
    <div
      className={`h-dvh w-screen overflow-hidden flex flex-col select-none transition-colors duration-200 ${
        isDark ? 'bg-[#09090d] text-white' : 'bg-[#f1f3f6] text-slate-900'
      }`}
    >
      {/* Top Minimal Calculator Bar */}
      <header
        className={`h-14 px-4 sm:px-6 flex items-center justify-between shrink-0 border-b backdrop-blur-md ${
          isDark ? 'border-white/[0.06] bg-[#0d0d12]/90' : 'border-slate-200/80 bg-white/85'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-[#f59e0b] flex items-center justify-center">
            <Calculator className="w-4 h-4 shrink-0" />
          </div>
          <span className="text-sm font-bold tracking-tight whitespace-nowrap">الآلة الحاسبة</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setScientificMode((prev) => !prev)}
            aria-label="الوضع العلمي"
            title="الوضع العلمي"
            className={`min-h-[40px] min-w-[40px] px-2.5 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              scientificMode
                ? 'bg-[#f59e0b] text-white'
                : isDark
                ? 'text-neutral-400 hover:text-white hover:bg-white/10'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-black/5'
            }`}
          >
            <FlaskConical className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline whitespace-nowrap">علمي</span>
          </button>

          <button
            type="button"
            onClick={() => setShowMobileHistory((prev) => !prev)}
            aria-label="سجل العمليات"
            title="سجل العمليات"
            className={`lg:hidden min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
              showMobileHistory
                ? 'bg-[#f59e0b] text-white'
                : isDark
                ? 'text-neutral-400 hover:text-white hover:bg-white/10'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-black/5'
            }`}
          >
            <History className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setCalcTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
            aria-label={isDark ? 'الوضع النهاري' : 'الوضع الليلي'}
            title={isDark ? 'الوضع النهاري' : 'الوضع الليلي'}
            className={`min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
              isDark
                ? 'text-neutral-400 hover:text-white hover:bg-white/10'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-black/5'
            }`}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Content Area: Full mobile calculator + Desktop History Sidebar */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Calculator Core Column */}
        <main className="flex-1 flex flex-col justify-between max-w-2xl mx-auto w-full px-4 pb-5 pt-2 sm:px-6 sm:pb-7 min-h-0">
          {/* Mobile History Overlay */}
          {showMobileHistory ? (
            <div className="flex-1 flex flex-col overflow-hidden py-2">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold">سجل العمليات الحسابية</h2>
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setHistory([])}
                    className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>مسح السجل</span>
                  </button>
                )}
              </div>

              {history.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-sm opacity-50 gap-2">
                  <History className="w-8 h-8 opacity-40" />
                  <span>لا توجد عمليات حسابية سابقة</span>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {history.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setDisplay(item.result);
                        setExpression(`${item.expression} =`);
                        setJustEvaluated(true);
                        setIsTypedInput(false);
                        setShowMobileHistory(false);
                      }}
                      className={`w-full text-left p-3.5 rounded-2xl transition-colors cursor-pointer ${
                        isDark
                          ? 'bg-[#141418] hover:bg-[#1e1e24] border border-white/5'
                          : 'bg-white hover:bg-neutral-50 border border-neutral-200'
                      }`}
                      dir="ltr"
                    >
                      <div className="text-xs opacity-60 font-mono tabular-nums truncate">
                        {item.expression}
                      </div>
                      <div className="text-xl font-semibold font-mono tabular-nums mt-0.5 truncate">
                        = {formatDisplayWithCommas(item.result)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Display Screen */}
              <div
                className={`flex-1 flex flex-col justify-end items-end px-4 sm:px-5 pb-4 sm:pb-5 pt-3 mb-3 rounded-3xl border min-h-[120px] ${
                  isDark
                    ? 'bg-[#111116]/90 border-white/[0.06] shadow-[inset_0_2px_10px_rgba(0,0,0,0.45)]'
                    : 'bg-white border-slate-200/90 shadow-xs'
                }`}
                dir="ltr"
              >
                <div className="w-full text-right overflow-x-auto no-scrollbar">
                  <div
                    className={`text-sm sm:text-base font-mono tabular-nums min-h-[24px] tracking-tight ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    {expression || '\u00A0'}
                  </div>
                </div>

                <div className="w-full flex items-center justify-between gap-2 mt-1">
                  <button
                    type="button"
                    onClick={handleBackspace}
                    aria-label="حذف رقم"
                    title="حذف آخر رقم"
                    className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                      isDark
                        ? 'text-slate-400 hover:text-white hover:bg-white/10'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Delete className="w-5 h-5" />
                  </button>

                  <div
                    className={`${displayFontSizeClass} font-light font-mono tabular-nums tracking-tight text-right truncate flex-1 leading-none py-1`}
                  >
                    {formattedDisplay}
                  </div>
                </div>
              </div>

              {/* Scientific Keys Strip (if toggled on) */}
              {scientificMode && (
                <div className="grid grid-cols-5 gap-2 mb-2.5 shrink-0" dir="ltr">
                  <button
                    type="button"
                    onClick={() => setIsDegree((d) => !d)}
                    className={`h-11 rounded-2xl text-xs font-bold transition-transform active:scale-95 cursor-pointer ${sciBtnClass}`}
                  >
                    {isDegree ? 'DEG' : 'RAD'}
                  </button>
                  <button
                    type="button"
                    onClick={() => applyScientificUnary('sin')}
                    className={`h-11 rounded-2xl text-xs font-semibold transition-transform active:scale-95 cursor-pointer ${sciBtnClass}`}
                  >
                    sin
                  </button>
                  <button
                    type="button"
                    onClick={() => applyScientificUnary('cos')}
                    className={`h-11 rounded-2xl text-xs font-semibold transition-transform active:scale-95 cursor-pointer ${sciBtnClass}`}
                  >
                    cos
                  </button>
                  <button
                    type="button"
                    onClick={() => applyScientificUnary('tan')}
                    className={`h-11 rounded-2xl text-xs font-semibold transition-transform active:scale-95 cursor-pointer ${sciBtnClass}`}
                  >
                    tan
                  </button>
                  <button
                    type="button"
                    onClick={() => applyScientificUnary('sqrt')}
                    className={`h-11 rounded-2xl text-sm font-semibold transition-transform active:scale-95 cursor-pointer ${sciBtnClass}`}
                  >
                    √x
                  </button>

                  <button
                    type="button"
                    onClick={() => applyScientificUnary('sq')}
                    className={`h-11 rounded-2xl text-xs font-semibold transition-transform active:scale-95 cursor-pointer ${sciBtnClass}`}
                  >
                    x²
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOperator('^')}
                    className={`h-11 rounded-2xl text-xs font-semibold transition-transform active:scale-95 cursor-pointer ${sciBtnClass}`}
                  >
                    xʸ
                  </button>
                  <button
                    type="button"
                    onClick={() => applyScientificUnary('ln')}
                    className={`h-11 rounded-2xl text-xs font-semibold transition-transform active:scale-95 cursor-pointer ${sciBtnClass}`}
                  >
                    ln
                  </button>
                  <button
                    type="button"
                    onClick={() => applyScientificUnary('log')}
                    className={`h-11 rounded-2xl text-xs font-semibold transition-transform active:scale-95 cursor-pointer ${sciBtnClass}`}
                  >
                    log
                  </button>
                  <button
                    type="button"
                    onClick={() => insertConstant('pi')}
                    className={`h-11 rounded-2xl text-sm font-semibold transition-transform active:scale-95 cursor-pointer ${sciBtnClass}`}
                  >
                    π
                  </button>
                </div>
              )}

              {/* Standard Keypad (Always LTR for authentic numeric order) */}
              <div className="grid grid-cols-4 gap-2.5 sm:gap-3 shrink-0" dir="ltr">
                {/* Row 1 */}
                <button
                  type="button"
                  onClick={handleClear}
                  className={`h-15 sm:h-17 rounded-2xl text-xl font-semibold transition-transform duration-100 active:scale-95 cursor-pointer ${fnBtnClass}`}
                >
                  {clearLabel}
                </button>
                <button
                  type="button"
                  onClick={handleToggleSign}
                  className={`h-15 sm:h-17 rounded-2xl text-xl font-semibold transition-transform duration-100 active:scale-95 cursor-pointer ${fnBtnClass}`}
                >
                  +/−
                </button>
                <button
                  type="button"
                  onClick={handlePercent}
                  className={`h-15 sm:h-17 rounded-2xl text-xl font-semibold transition-transform duration-100 active:scale-95 cursor-pointer ${fnBtnClass}`}
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => handleOperator('÷')}
                  className={`h-15 sm:h-17 rounded-2xl text-2xl font-semibold transition-transform duration-100 active:scale-95 cursor-pointer ${opBtnClass(
                    '÷'
                  )}`}
                >
                  ÷
                </button>

                {/* Row 2 */}
                {['7', '8', '9'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => inputDigit(d)}
                    className={`h-15 sm:h-17 rounded-2xl text-2xl font-medium tabular-nums transition-transform duration-100 active:scale-95 cursor-pointer ${numBtnClass}`}
                  >
                    {d}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleOperator('×')}
                  className={`h-15 sm:h-17 rounded-2xl text-2xl font-semibold transition-transform duration-100 active:scale-95 cursor-pointer ${opBtnClass(
                    '×'
                  )}`}
                >
                  ×
                </button>

                {/* Row 3 */}
                {['4', '5', '6'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => inputDigit(d)}
                    className={`h-15 sm:h-17 rounded-2xl text-2xl font-medium tabular-nums transition-transform duration-100 active:scale-95 cursor-pointer ${numBtnClass}`}
                  >
                    {d}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleOperator('-')}
                  className={`h-15 sm:h-17 rounded-2xl text-2xl font-semibold transition-transform duration-100 active:scale-95 cursor-pointer ${opBtnClass(
                    '-'
                  )}`}
                >
                  −
                </button>

                {/* Row 4 */}
                {['1', '2', '3'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => inputDigit(d)}
                    className={`h-15 sm:h-17 rounded-2xl text-2xl font-medium tabular-nums transition-transform duration-100 active:scale-95 cursor-pointer ${numBtnClass}`}
                  >
                    {d}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleOperator('+')}
                  className={`h-15 sm:h-17 rounded-2xl text-2xl font-semibold transition-transform duration-100 active:scale-95 cursor-pointer ${opBtnClass(
                    '+'
                  )}`}
                >
                  +
                </button>

                {/* Row 5 */}
                <button
                  type="button"
                  onClick={() => inputDigit('0')}
                  className={`col-span-2 h-15 sm:h-17 rounded-2xl text-2xl font-medium tabular-nums text-left pl-7 transition-transform duration-100 active:scale-95 cursor-pointer ${numBtnClass}`}
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={inputDecimal}
                  className={`h-15 sm:h-17 rounded-2xl text-2xl font-semibold transition-transform duration-100 active:scale-95 cursor-pointer ${numBtnClass}`}
                >
                  .
                </button>
                <button
                  type="button"
                  onClick={handleEquals}
                  className="h-15 sm:h-17 rounded-2xl text-2xl font-semibold bg-[#f59e0b] hover:bg-[#e69107] active:bg-[#d97706] text-white transition-transform duration-100 active:scale-95 cursor-pointer"
                >
                  =
                </button>
              </div>
            </>
          )}
        </main>

        {/* Desktop Calculation History Side Panel (Windows/macOS Calculator style) */}
        <aside
          className={`hidden lg:flex w-80 shrink-0 flex-col border-r ${
            isDark ? 'border-white/[0.06] bg-[#0e0e13]' : 'border-slate-200/90 bg-white'
          }`}
        >
          <div
            className={`px-4 py-3.5 flex items-center justify-between border-b ${
              isDark ? 'border-white/5' : 'border-neutral-200'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-bold">
              <History className="w-4 h-4 text-[#f59e0b]" />
              <span>سجل العمليات</span>
            </div>
            {history.length > 0 && (
              <button
                type="button"
                onClick={() => setHistory([])}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-500/10 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>مسح</span>
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-xs opacity-50 gap-2">
              <History className="w-7 h-7 opacity-40" />
              <span>لا توجد عمليات حسابية مسجلة بعد</span>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {history.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setDisplay(item.result);
                    setExpression(`${item.expression} =`);
                    setJustEvaluated(true);
                    setIsTypedInput(false);
                  }}
                  className={`w-full text-left p-3 rounded-xl transition-colors cursor-pointer ${
                    isDark
                      ? 'hover:bg-white/5 border border-white/5'
                      : 'hover:bg-neutral-50 border border-neutral-200/80'
                  }`}
                  dir="ltr"
                >
                  <div className="text-xs opacity-60 font-mono tabular-nums truncate">
                    {item.expression}
                  </div>
                  <div className="text-lg font-semibold font-mono tabular-nums mt-0.5 truncate">
                    = {formatDisplayWithCommas(item.result)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
