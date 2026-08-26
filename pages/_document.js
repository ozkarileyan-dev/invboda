import { Html, Head, Main, NextScript } from "next/document";

const stylesheets = [
  "themify-icons.css",
  "font-awesome.min.css",
  "flaticon.css",
  "bootstrap.min.css",
  "magnific-popup.css",
  "animate.css",
  "owl.carousel.css",
  "owl.theme.css",
  "slick.css",
  "slick-theme.css",
  "swiper.min.css",
  "nice-select.css",
  "owl.transitions.css",
  "jquery.fancybox.css",
  "jquery-ui.css",
  "odometer-theme-default.css"
];

export default function Document() {
  return (
    <Html lang="es">
      <Head>
        <link rel="shortcut icon" type="image/png" href="/assets/images/favicon.png" />
        {stylesheets.map((file) => (
          <link key={file} rel="stylesheet" href={`/assets/css/${file}`} />
        ))}
        <link rel="stylesheet" href="/assets/sass/style.css" />
        <link rel="stylesheet" href="/assets/css/rsvp.css" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
