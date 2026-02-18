import { useCallback, useState, useMemo } from 'react';
import { differenceInDays, eachDayOfInterval, isSameDay } from 'date-fns';

export type UseBookingDateRangeSelectionParams = {
  checkIn: Date | null;
  checkOut: Date | null;
  onDatesChange: (checkIn: Date | null, checkOut: Date | null) => void;
  isDateBlocked?: (date: Date) => boolean;
  minNights?: number;
  maxNights?: number;
  maxBookingHorizonDays?: number; // Max days from today (default: 730 = 24 months)
};

// Default booking horizon: 24 months / 730 days (per plan requirements)
const DEFAULT_MAX_BOOKING_HORIZON_DAYS = 730;

export function useBookingDateRangeSelection({
  checkIn,
  checkOut,
  onDatesChange,
  isDateBlocked,
  minNights = 1,
  maxNights = 30,
  maxBookingHorizonDays = DEFAULT_MAX_BOOKING_HORIZON_DAYS,
}: UseBookingDateRangeSelectionParams) {
  const [selectingCheckout, setSelectingCheckout] = useState(false);
  const [stayError, setStayError] = useState<string | null>(null);

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

  const isBlocked = useCallback(
    (date: Date) => (isDateBlocked ? isDateBlocked(date) : false),
    [isDateBlocked],
  );

  const isDateBeyondHorizon = useCallback(
    (date: Date) => {
      return date > maxDate;
    },
    [maxDate],
  );

  const clearDates = useCallback(() => {
    onDatesChange(null, null);
    setSelectingCheckout(false);
    setStayError(null);
  }, [onDatesChange]);

  const handleDateSelect = useCallback(
    (date: Date | undefined) => {
      if (!date) return;
      
      // Check if date is blocked
      if (isBlocked(date)) {
        setStayError('This date is unavailable');
        return;
      }

      // Check if date is beyond booking horizon
      if (isDateBeyondHorizon(date)) {
        setStayError(`Bookings can only be made up to ${maxBookingHorizonDays} days in advance`);
        return;
      }

      setStayError(null);

      // If no check-in selected, set check-in
      if (!checkIn) {
        onDatesChange(date, null);
        setSelectingCheckout(true);
        return;
      }

      // If both dates are selected, start new selection
      if (checkIn && checkOut) {
        onDatesChange(date, null);
        setSelectingCheckout(true);
        return;
      }

      // If clicking the same date as check-in, clear selection
      if (isSameDay(date, checkIn)) {
        clearDates();
        return;
      }

      // Determine start and end dates
      const [startDate, endDate] = date > checkIn ? [checkIn, date] : [date, checkIn];

      // Check if any date in range is blocked
      const datesInRange = eachDayOfInterval({ start: startDate, end: endDate });
      const hasBlockedDate = datesInRange.some((d) => isBlocked(d));
      if (hasBlockedDate) {
        setStayError('Selected range contains unavailable dates');
        onDatesChange(date, null);
        setSelectingCheckout(true);
        return;
      }

      // Check if end date is beyond horizon
      if (isDateBeyondHorizon(endDate)) {
        setStayError(`Check-out date exceeds maximum booking horizon of ${maxBookingHorizonDays} days`);
        onDatesChange(date, null);
        setSelectingCheckout(true);
        return;
      }

      // Validate minimum nights
      const nights = differenceInDays(endDate, startDate);
      if (nights < minNights) {
        setStayError(`Minimum stay is ${minNights} night${minNights > 1 ? 's' : ''}`);
        onDatesChange(startDate, endDate);
        setSelectingCheckout(false);
        return;
      }
      
      // Validate maximum nights
      if (nights > maxNights) {
        setStayError(`Maximum stay is ${maxNights} nights`);
        onDatesChange(startDate, endDate);
        setSelectingCheckout(false);
        return;
      }

      // Valid selection
      onDatesChange(startDate, endDate);
      setSelectingCheckout(false);
    },
    [checkIn, checkOut, clearDates, isBlocked, isDateBeyondHorizon, maxNights, minNights, onDatesChange, maxBookingHorizonDays],
  );

  return {
    selectingCheckout,
    setSelectingCheckout,
    stayError,
    setStayError,
    clearDates,
    handleDateSelect,
    maxDate, // Expose max date for use in components
  };
}

