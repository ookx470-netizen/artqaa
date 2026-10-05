import { useQueryClient } from "@tanstack/react-query";
import {
  getGetDashboardQueryKey, getListActivityQueryKey, getListWithdrawalsQueryKey, getGetSessionQueryKey,
  getListDepositsQueryKey, getGetSettingsQueryKey, getListPlansQueryKey, getGetAdminStatsQueryKey,
  getListUsersQueryKey, getListAdminPlansQueryKey, getListAdminDepositsQueryKey, getListAdminWithdrawalsQueryKey,
} from "@workspace/api-client-react";

export function useInvalidateAll() {
  const qc = useQueryClient();
  return () => {
    [
      getGetDashboardQueryKey(), getListActivityQueryKey(), getListWithdrawalsQueryKey(), getGetSessionQueryKey(),
      getListDepositsQueryKey(), getGetSettingsQueryKey(), getListPlansQueryKey(), getGetAdminStatsQueryKey(),
      getListUsersQueryKey(), getListAdminPlansQueryKey(), getListAdminDepositsQueryKey(), getListAdminWithdrawalsQueryKey(),
    ].forEach((k) => qc.invalidateQueries({ queryKey: k }));
  };
}

export const live = { refetchOnWindowFocus: true, refetchInterval: 30000 };
