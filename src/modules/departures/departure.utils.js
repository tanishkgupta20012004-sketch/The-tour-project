export function computeDepartureStatus({
  total_seats,
  booked_seats,
  offline_blocked_seats,
  min_group_size,
  current_status
}) {
  if (current_status === 'CANCELLED' || current_status === 'COMPLETED') {
    return current_status;
  }

  const occupied = Number(booked_seats || 0) + Number(offline_blocked_seats || 0);
  const total = Number(total_seats || 0);
  const minGroup = Number(min_group_size || 1);
  const available = Math.max(0, total - occupied);

  if (available === 0) {
    return 'SOLD_OUT';
  }
  if (available <= Math.max(2, Math.ceil(total * 0.2))) {
    return 'FILLING_FAST';
  }
  if (occupied >= minGroup) {
    return 'GUARANTEED';
  }
  return 'OPEN';
}

export function formatDepartureConfidence(dep) {
  const totalSeats = Number(dep.total_seats || 0);
  const bookedSeats = Number(dep.booked_seats || 0);
  const offlineBlockedSeats = Number(dep.offline_blocked_seats || 0);
  const occupiedSeats = bookedSeats + offlineBlockedSeats;
  const availableSeats = Math.max(0, totalSeats - occupiedSeats);
  const minGroupSize = Number(dep.min_group_size || 1);
  const seatsNeededForGuarantee = Math.max(0, minGroupSize - occupiedSeats);
  const isGuaranteed = occupiedSeats >= minGroupSize;
  const occupancyPct = totalSeats > 0 ? Math.round((occupiedSeats / totalSeats) * 100) : 0;

  const confirmedAt = dep.inventory_last_confirmed_at
    ? new Date(dep.inventory_last_confirmed_at)
    : new Date();
  const hoursSinceConfirm = Math.max(
    0,
    Math.round(((Date.now() - confirmedAt.getTime()) / (1000 * 60 * 60)) * 10) / 10
  );

  let confidenceBadge = 'Open for Booking';
  if (dep.departure_status === 'CANCELLED') {
    confidenceBadge = 'Cancelled';
  } else if (availableSeats === 0) {
    confidenceBadge = 'Sold Out';
  } else if (availableSeats <= 4) {
    confidenceBadge = `Filling Fast • Only ${availableSeats} seat(s) left`;
  } else if (isGuaranteed) {
    confidenceBadge = `Guaranteed Departure (${occupiedSeats}/${totalSeats} seats filled)`;
  } else {
    confidenceBadge = `${seatsNeededForGuarantee} more seat(s) needed to guarantee departure`;
  }

  return {
    ...dep,
    confidence_metrics: {
      total_seats: totalSeats,
      booked_on_platform: bookedSeats,
      filled_offline_or_instagram: offlineBlockedSeats,
      total_occupied_seats: occupiedSeats,
      available_seats: availableSeats,
      min_group_size: minGroupSize,
      seats_needed_for_guarantee: seatsNeededForGuarantee,
      is_departure_guaranteed: isGuaranteed,
      occupancy_percentage: occupancyPct,
      inventory_last_confirmed_at: dep.inventory_last_confirmed_at,
      inventory_freshness_hours: hoursSinceConfirm,
      confidence_badge: confidenceBadge
    }
  };
}
