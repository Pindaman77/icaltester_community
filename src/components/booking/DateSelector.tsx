import { useMemo, useState, useEffect } from 'react';
import { format, differenceInDays, isSameDay } from 'date-fns';
import { CalendarIcon, Loader2, Ban, ChevronDown, AlertCircle, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useBookingDateRangeSelection } from './useBookingDateRangeSelection';
import type { DateRange } from 'react-day-picker';

type DateSelectorProps = {
  checkIn: Date | null;
  checkOut: Date | null;
  onDatesChange: (checkIn: Date | null, checkOut: Date | null) => void;
  onContinue?: () => void;
  minNights?: number;
  maxNights?: number;
  blockedDates?: Date[];
  isLoading?: boolean;
  maxBookingHorizonDays?: number; // Max days from today (default: 730 = 24 months)
};

// Default booking horizon: 24 months / 730 days (per plan requirements)
const DEFAULT_MAX_BOOKING_HORIZON_DAYS = 730;

export function DateSelector({
  checkIn,
  checkOut,
  onDatesChange,
  onContinue,
  minNights = 1,
  maxNights = 30,
  blockedDates = [],
  isLoading = false,
  maxBookingHorizonDays = DEFAULT_MAX_BOOKING_HORIZON_DAYS,
}: DateSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [month, setMonth] = useState<Date>(() => {
    // Start with current month, or check-in month if selected
    return checkIn || new Date();
  });

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const maxDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + maxBookingHorizonDays);
    return d;
  }, [today, maxBookingHorizonDays]);

  const isDateBlocked = (date: Date) => blockedDates.some((blockedDate) => isSameDay(blockedDate, date));

  const {
    selectingCheckout,
    setSelectingCheckout,
    stayError,
    setStayError,
    clearDates,
    handleDateSelect,
  } = useBookingDateRangeSelection({
    checkIn,
    checkOut,
    onDatesChange,
    isDateBlocked,
    minNights,
    maxNights,
  });

  const selectedNights = checkIn && checkOut ? differenceInDays(checkOut, checkIn) : 0;
  const isValidStay = selectedNights >= minNights && selectedNights <= maxNights;

  const formatDateDisplay = (date: Date | null, placeholder: string) =>
    date ? format(date, 'MMM d, yyyy') : placeholder;

  // Convert to DateRange for react-day-picker range mode
  const selectedRange: DateRange | undefined = useMemo(() => {
    if (!checkIn) return undefined;
    return {
      from: checkIn,
      to: checkOut || undefined,
    };
  }, [checkIn, checkOut]);

  // Handle range selection from calendar
  const handleRangeSelect = (range: DateRange | undefined) => {
    if (!range?.from) {
      onDatesChange(null, null);
      setSelectingCheckout(false);
      setStayError(null);
      return;
    }

    // If only from is selected, set check-in and wait for check-out
    if (range.from && !range.to) {
      // Validate check-in date
      if (isDateBlocked(range.from)) {
        setStayError('This date is unavailable');
        return;
      }
      if (range.from < today) {
        setStayError('Cannot select past dates');
        return;
      }
      if (range.from > maxDate) {
        setStayError(`Bookings can only be made up to ${maxBookingHorizonDays} days in advance`);
        return;
      }
      
      onDatesChange(range.from, null);
      setSelectingCheckout(true);
      setStayError(null);
      return;
    }

    // If both from and to are selected, validate the full range
    if (range.from && range.to) {
      // Use the validation logic from the hook
      handleDateSelect(range.to);
    }
  };

  // Determine if date should be disabled
  const isDateDisabled = (date: Date) => {
    // Disable past dates
    if (date < today) return true;
    
    // Disable dates beyond booking horizon
    if (date > maxDate) return true;
    
    // Disable blocked dates
    if (isDateBlocked(date)) return true;
    
    return false;
  };

  // Navigate to check-in month when check-in is selected
  const handleMonthChange = (newMonth: Date) => {
    setMonth(newMonth);
  };

  // Update month when check-in changes to show the selected month
  useEffect(() => {
    if (checkIn) {
      const checkInMonth = new Date(checkIn.getFullYear(), checkIn.getMonth(), 1);
      const currentMonth = new Date(month.getFullYear(), month.getMonth(), 1);
      if (checkInMonth.getTime() !== currentMonth.getTime()) {
        setMonth(checkInMonth);
      }
    }
  }, [checkIn, month]);

  return (
    <div className="space-y-3">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-between h-12 px-4 font-normal">
            <div className="flex items-center gap-2 min-w-0">
              <CalendarIcon className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className={`text-sm ${!checkIn ? 'text-muted-foreground' : ''}`}>
                {formatDateDisplay(checkIn, 'Check In')}
              </span>
              <span className="text-muted-foreground">—</span>
              <span className={`text-sm ${!checkOut ? 'text-muted-foreground' : ''}`}>
                {formatDateDisplay(checkOut, 'Check Out')}
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-popover" align="start" sideOffset={4}>
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="flex flex-col">
              {/* Header with check-in/check-out indicators */}
              <div className="flex border-b border-border">
                <div
                  className={`flex-1 px-4 py-3 text-center text-sm font-medium transition-colors ${
                    !checkIn || (!checkOut && !selectingCheckout)
                      ? 'bg-primary/10 text-primary border-b-2 border-primary -mb-px'
                      : 'text-muted-foreground'
                  }`}
                >
                  <span className="block text-xs text-muted-foreground mb-1">Check-in</span>
                  <span className={`text-base font-semibold ${checkIn ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {checkIn ? format(checkIn, 'MMM d') : 'Add date'}
                  </span>
                </div>
                <div
                  className={`flex-1 px-4 py-3 text-center text-sm font-medium transition-colors ${
                    selectingCheckout && checkIn
                      ? 'bg-primary/10 text-primary border-b-2 border-primary -mb-px'
                      : 'text-muted-foreground'
                  }`}
                >
                  <span className="block text-xs text-muted-foreground mb-1">Check-out</span>
                  <span className={`text-base font-semibold ${checkOut ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {checkOut ? format(checkOut, 'MMM d') : 'Add date'}
                  </span>
                </div>
                {checkIn && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      clearDates();
                    }}
                    className="px-3 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    title="Clear dates"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Dual calendar view - two months side by side */}
              <div className="flex">
                <Calendar
                  mode="range"
                  selected={selectedRange}
                  onSelect={handleRangeSelect}
                  disabled={isDateDisabled}
                  month={month}
                  onMonthChange={handleMonthChange}
                  numberOfMonths={2}
                  defaultMonth={month}
                  modifiers={{
                    blocked: blockedDates,
                  }}
                  modifiersClassNames={{
                    blocked: 'bg-destructive/10 text-destructive line-through cursor-not-allowed opacity-50',
                  }}
                  className="rounded-md border-0"
                  classNames={{
                    months: 'flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0',
                    month: 'space-y-4',
                    caption: 'flex justify-center pt-1 relative items-center',
                    caption_label: 'text-sm font-medium',
                    nav: 'space-x-1 flex items-center',
                    nav_button: 'h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
                    nav_button_previous: 'absolute left-1',
                    nav_button_next: 'absolute right-1',
                    table: 'w-full border-collapse space-y-1',
                    head_row: 'flex',
                    head_cell: 'text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]',
                    row: 'flex w-full mt-2',
                    cell: 'h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20',
                    day: 'h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground',
                    day_selected: 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground',
                    day_range_start: 'bg-primary text-primary-foreground rounded-l-full',
                    day_range_end: 'day-range-end bg-primary text-primary-foreground rounded-r-full',
                    day_range_middle: 'bg-primary/20 text-primary-foreground',
                    day_today: 'bg-accent text-accent-foreground font-semibold',
                    day_outside: 'day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30',
                    day_disabled: 'text-muted-foreground opacity-50 cursor-not-allowed',
                    day_hidden: 'invisible',
                  }}
                />
              </div>

              {/* Footer with info and errors */}
              <div className="px-4 pb-4 pt-2 space-y-2 border-t border-border">
                {selectedNights > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Stay duration:</span>
                      <span className="font-medium">
                        {selectedNights} night{selectedNights !== 1 ? 's' : ''}
                      </span>
                    </div>
                    {checkIn && checkOut && isValidStay && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => setIsOpen(false)}
                        className="h-7 px-3 text-xs"
                      >
                        Confirm
                      </Button>
                    )}
                  </div>
                )}
                {stayError && (
                  <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 p-2 rounded-md">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{stayError}</span>
                  </div>
                )}
                {blockedDates.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Ban className="w-3.5 h-3.5 text-destructive shrink-0" />
                    <span>{blockedDates.length} unavailable date{blockedDates.length !== 1 ? 's' : ''} shown</span>
                  </div>
                )}
                {!checkIn && (
                  <div className="text-xs text-muted-foreground pt-1">
                    Select your check-in date to begin
                  </div>
                )}
                {checkIn && !checkOut && (
                  <div className="text-xs text-muted-foreground pt-1">
                    Now select your check-out date
                  </div>
                )}
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {checkIn && checkOut && onContinue && (
        <>
          {stayError && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{stayError}</span>
            </div>
          )}
          <Button size="lg" onClick={onContinue} className="w-full" disabled={!isValidStay}>
            Continue
          </Button>
        </>
      )}
    </div>
  );
}

