// Imported first by main.tsx: read #edition=… and #code=… from the link (now and on later fragment
// changes) and scrub them from the address bar BEFORE the router sees the fragment. Order matters:
// these hashchange listeners must run before the router's, which may redirect and replace the URL.
import "./edition";
import { captureSource } from "@/lib/source";
import { watchAccessCode } from "@proto/ui/access.js";
captureSource();
watchAccessCode();
