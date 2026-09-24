import { NavShell } from '@/components/NavShell';
import { TodayScreen } from '@/components/TodayScreen';
import { todayKey } from '@/lib/dates';

export default function TodayPage() {
  return (
    <NavShell>
      <TodayScreen date={todayKey()} />
    </NavShell>
  );
}
