/**
 * Department visibility, resolved in one place.
 *
 * The admin console has a sidebar department selector that sends `?dept=<id>`.
 * Several endpoints need to honour it, and each of them also has to respect the
 * role rules that already exist:
 *
 *   admin    → may narrow to any department, or see everything
 *   officer  → always confined to their own department, whatever `dept` says
 *   citizen  → never reaches these endpoints
 *
 * This lives in one function rather than being repeated per route because the
 * officer rule is a security boundary, not a convenience. Copying it into five
 * handlers is how one of them ends up trusting `?dept=` and quietly lets an
 * officer read another department's data.
 */

import { prisma } from '../db';

export interface SessionUserLike {
  id: string;
  role: 'citizen' | 'officer' | 'admin';
}

export interface DeptScope {
  /** Department to confine results to, or undefined for "everything". */
  departmentId?: string;
  /**
   * True when the caller can legitimately see nothing at all — an officer with
   * no department assigned. Callers must return an empty result rather than
   * falling through to an unfiltered query, which is what "no scope" would
   * otherwise mean.
   */
  impossible: boolean;
}

/**
 * Resolve the department filter for an officer/admin request.
 *
 * `deptParam` is the untrusted `?dept=` value. It is only honoured for admins.
 */
export async function resolveDeptScope(
  user: SessionUserLike,
  deptParam: string | undefined,
): Promise<DeptScope> {
  if (user.role === 'officer') {
    const officer = await prisma.user.findUnique({
      where: { id: user.id },
      select: { departmentId: true },
    });
    if (!officer?.departmentId) {
      // Seeing nothing is the safer default than seeing everything.
      return { impossible: true };
    }
    // Deliberately ignores deptParam: an officer cannot widen their own scope.
    return { departmentId: officer.departmentId, impossible: false };
  }

  // Admin. An empty or 'all' value means no narrowing.
  const wanted = deptParam?.trim();
  if (!wanted || wanted === 'all') return { impossible: false };
  return { departmentId: wanted, impossible: false };
}

/** Read `?dept=` off a request URL. */
export function deptParamFrom(url: string): string | undefined {
  return new URL(url).searchParams.get('dept') ?? undefined;
}
