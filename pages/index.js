import Head from "next/head";

const stylesheets = [
  "themify-icons.css", "font-awesome.min.css", "flaticon.css", "bootstrap.min.css",
  "magnific-popup.css", "animate.css", "owl.carousel.css", "owl.theme.css", "slick.css",
  "slick-theme.css", "swiper.min.css", "nice-select.css", "owl.transitions.css",
  "jquery.fancybox.css", "jquery-ui.css", "odometer-theme-default.css"
];

export async function getStaticProps() {
  const { readFile } = await import("fs/promises");
  const { join } = await import("path");
  const template = await readFile(join(process.cwd(), "public", "index.html"), "utf8");
  const body = template.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] || "";
  return { props: { body } };
}

export default function InvitationPage({ body }) {
  return (
    <>
      <Head>
        <title>Naye &amp; Oscar · 21 Noviembre 2026</title>
        <meta name="description" content="Invitación de boda de Naye y Oscar" />
        <link rel="shortcut icon" type="image/png" href="/assets/images/favicon.png" />
        {stylesheets.map((file) => <link key={file} rel="stylesheet" href={`/assets/css/${file}`} />)}
        <link rel="stylesheet" href="/assets/sass/style.css" />
        <link rel="stylesheet" href="/assets/css/rsvp.css" />
      </Head>
      <main suppressHydrationWarning dangerouslySetInnerHTML={{ __html: body }} />
    </>
  );
}
