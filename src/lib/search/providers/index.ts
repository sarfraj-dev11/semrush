import { registerProvider } from "../registry";
import { DataForSeoProvider } from "./dataforseo";
import { SerpApiProvider } from "./serpapi";
import { SerperProvider } from "./serper";

/**
 * Importing this module registers every provider. Only ones with credentials
 * present will resolve, so registering all of them is safe.
 */
registerProvider(new DataForSeoProvider());
registerProvider(new SerpApiProvider());
registerProvider(new SerperProvider());

export { DataForSeoProvider } from "./dataforseo";
export { SerpApiProvider } from "./serpapi";
export { SerperProvider } from "./serper";
export { SearchConsoleClient } from "./search-console";
