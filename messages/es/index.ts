import build from "./build.json";
import catalog from "./catalog.json";
import common from "./common.json";
import emails from "./emails.json";
import forms from "./forms.json";
import home from "./home.json";
import meta from "./meta.json";
import portal from "./portal.json";
import quote from "./quote.json";

/** Un archivo por área. Al agregar un área nueva, se importa aquí en ambos idiomas. */
const messages = { build, catalog, common, emails, forms, home, meta, portal, quote };

export default messages;
