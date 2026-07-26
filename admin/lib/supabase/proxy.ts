import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@washly/shared";

const PUBLIC_PATHS = ["/login"];

// Route protection for every admin route per story 3.9: "Admin login is
// separate from student auth". A valid Supabase session alone isn't
// sufficient -- it only proves *some* account exists (which could be a
// student's), so this also checks for a matching admin_users row and
// signs the caller out (not just redirects) if there isn't one, per the
// requirement that a non-admin account shouldn't be left in a logged-in
// state that keeps bouncing back here.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() (not getSession()) -- it revalidates against Supabase Auth
  // rather than trusting the JWT in the cookie as-is, which matters here
  // since this is the gate for every admin route.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.includes(request.nextUrl.pathname);

  if (!user) {
    if (isPublicPath) {
      return response;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // A session exists -- but only a provisioned admin_users row makes this
  // an admin session. RLS on admin_users ("id = auth.uid() or
  // is_super_admin()") already lets any authenticated caller see their
  // own row if one exists, so this needs no special privileges to check.
  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (!adminRow) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("message", "This account doesn't have admin access.");
    return NextResponse.redirect(url);
  }

  if (isPublicPath) {
    // Already an admin session -- /login has nothing to do here.
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
