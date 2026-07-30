(function ($) {
    "use strict";

    /*------------------------------------------
        Nice Select
    -------------------------------------------*/
    if ($(".select").length) {
        $(".select").niceSelect();
    }

    /*------------------------------------------
        = ALL ESSENTIAL FUNCTIONS
    -------------------------------------------*/

    // Cached selectors
    const $navigationHolder = $(".navigation-holder");
    const $mobileMenuOpenBtn = $(".mobile-menu .open-btn");
    const $mobileMenuToggleBtn = $(".mobile-menu .navbar-toggler");
    const $mainNavUl = $("#navbar > ul");
    const $body = $("body");
    const $menuCloseBtns = $(".menu-close");

    /**
     * Debounce helper
     */
    function debounce(func, wait) {
        wait = wait || 150;
        let timeout;
        return function () {
            const args = arguments;
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(function () {
                func.apply(context, args);
            }, wait);
        };
    }

    /**
     * Toggle mobile navigation
     */
    function toggleMobileNavigation() {
        if ($mobileMenuOpenBtn.length) {
            $mobileMenuOpenBtn.on("click", function (e) {
                e.stopImmediatePropagation();
                $navigationHolder.toggleClass("slideIn");
                $mobileMenuToggleBtn.toggleClass("x-close");
                return false;
            });
        }
    }
    toggleMobileNavigation();

    /**
     * Toggle class for small nav based on window width
     */
    function toggleClassForSmallNav() {
        if (window.innerWidth <= 991) {
            $mainNavUl.addClass("small-nav");
        } else {
            $mainNavUl.removeClass("small-nav");
        }
    }

    /**
     * Small navigation submenu toggle functionality
     */
    function smallNavFunctionality() {
        const windowWidth = window.innerWidth;
        const $smallNav = $navigationHolder.find("> .small-nav");
        const $subMenus = $smallNav.find(".sub-menu");
        const $megaMenus = $smallNav.find(".mega-menu");
        const $menuItemsWithChildren = $smallNav.find(".menu-item-has-children > a");

        if (windowWidth <= 991) {
            $subMenus.hide();
            $megaMenus.hide();
            $menuItemsWithChildren.off("click").on("click", function (e) {
                e.preventDefault();
                e.stopImmediatePropagation();
                $(this).siblings().slideToggle();
                $(this).toggleClass("rotate");
            });
        } else {
            $navigationHolder.find(".sub-menu, .mega-menu").show();
            $menuItemsWithChildren.off("click");
        }
    }

    /**
     * Close navigation menu and toggle button states
     */
    function closeNavigation() {
        $navigationHolder.removeClass("slideIn");
        $mobileMenuToggleBtn.removeClass("x-close");
    }

    // Initialize functions and bind event listeners
    function initEssentialFunctions() {
        toggleClassForSmallNav();
        smallNavFunctionality();

        $(window).on("resize", debounce(function () {
            toggleClassForSmallNav();
            smallNavFunctionality();
        }, 200));

        $body.on("click", closeNavigation);
        $menuCloseBtns.on("click", closeNavigation);
    }
    initEssentialFunctions();

    /**
     * Active menu item on scroll
     */
    function activeMenuItem($links) {
        const top = $(window).scrollTop();
        const nav = $links;
        const navHeight = nav.outerHeight();

        $("section").each(function () {
            const sectionTop = $(this).offset().top - navHeight;
            const sectionBottom = sectionTop + $(this).outerHeight();
            if (top >= sectionTop && top <= sectionBottom) {
                nav.find("> ul > li > a").parent().removeClass("current-menu-item");
                nav.find("a[href='#" + $(this).attr("id") + "']").parent().addClass("current-menu-item");
            } else if (top === 0) {
                nav.find("> ul > li > a").parent().removeClass("current-menu-item");
            }
        });
    }

    /**
     * Smooth scrolling
     */
    function smoothScrolling($scrollLinks, topOffset) {
        $scrollLinks.on("click", function (e) {
            if (
                location.pathname.replace(/^\//, "") === this.pathname.replace(/^\//, "") &&
                location.hostname === this.hostname
            ) {
                let target = $(this.hash);
                target = target.length ? target : $("[name=" + this.hash.slice(1) + "]");
                if (target.length) {
                    $("html, body").animate(
                        { scrollTop: target.offset().top - topOffset },
                        1000,
                        "easeInOutExpo"
                    );
                    e.preventDefault();
                }
            }
        });
    }

    /*------------------------------------------
        Toggle Sections
    -------------------------------------------*/
    $("[id^='toggle']").on("click", function () {
        const toggleId = $(this).attr("id").replace("toggle", "open");
        const $target = $("#" + toggleId);
        if ($target.length) {
            $target.slideToggle();
        }
        if ($(this).is("#toggle1")) {
            $(".create-account").slideToggle();
            $(".caupon-wrap.s1").toggleClass("active-border");
        }
        if ($(this).is("#toggle2, #toggle3")) {
            $(".caupon-wrap.s2").toggleClass("coupon-2");
        }
        if ($(this).is("#toggle4")) {
            $(".caupon-wrap.s3").toggleClass("coupon-2");
        }
    });

    /*------------------------------------------
        Payment Option Toggle
    -------------------------------------------*/
    $(".payment-select .addToggle").on("click", function () {
        $(".payment-name").addClass("active");
        $(".payment-option").removeClass("active");
    });

    $(".payment-select .removeToggle").on("click", function () {
        $(".payment-option").addClass("active");
        $(".payment-name").removeClass("active");
    });

    /*------------------------------------------
        Datepicker
    -------------------------------------------*/
    if ($("#datepicker").length && $.fn.datepicker) {
        $("#datepicker").datepicker();
    }

    /*------------------------------------------
        Tooltips (Bootstrap 5)
    -------------------------------------------*/
    if (typeof bootstrap !== "undefined" && bootstrap.Tooltip) {
        var tooltipTriggerList = Array.prototype.slice.call(
            document.querySelectorAll('[data-bs-toggle="tooltip"]')
        );
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }

    /*------------------------------------------
        = PARALLAX BACKGROUND
    -------------------------------------------*/
    function bgParallax() {
        if ($(".parallax").length) {
            $(".parallax").each(function () {
                const sectionTop = $(this).offset().top;
                const scrollTop = $(window).scrollTop();
                const resize = sectionTop - scrollTop;
                const doParallax = -(resize / 5);
                const positionValue = doParallax + "px";
                const img = $(this).data("bg-image");
                $(this).css({
                    backgroundImage: img ? "url(" + img + ")" : "",
                    backgroundPosition: "50% " + positionValue,
                    backgroundSize: "cover",
                    backgroundRepeat: "no-repeat"
                });
            });
        }
    }

    $(window).on("scroll", debounce(bgParallax, 15));
    $(window).on("resize", debounce(bgParallax, 50));

    /*------------------------------------------
        = HERO SLIDER (Swiper)
    -------------------------------------------*/
    const interleaveOffset = 0.5;
    const swiperOptions = {
        loop: true,
        speed: 1000,
        parallax: true,
        autoplay: {
            delay: 6500,
            disableOnInteraction: false
        },
        watchSlidesProgress: true,
        pagination: {
            el: ".swiper-pagination",
            clickable: true
        },
        navigation: {
            nextEl: ".swiper-button-next",
            prevEl: ".swiper-button-prev"
        },
        on: {
            progress: function () {
                const swiper = this;
                for (let i = 0; i < swiper.slides.length; i++) {
                    const slideProgress = swiper.slides[i].progress;
                    const innerOffset = swiper.width * interleaveOffset;
                    const innerTranslate = slideProgress * innerOffset;
                    const inner = swiper.slides[i].querySelector(".slide-inner");
                    if (inner) {
                        inner.style.transform = "translate3d(" + innerTranslate + "px, 0, 0)";
                    }
                }
            },
            touchStart: function () {
                const swiper = this;
                for (let i = 0; i < swiper.slides.length; i++) {
                    swiper.slides[i].style.transition = "";
                }
            },
            setTransition: function (speed) {
                const swiper = this;
                for (let i = 0; i < swiper.slides.length; i++) {
                    swiper.slides[i].style.transition = speed + "ms";
                    const inner = swiper.slides[i].querySelector(".slide-inner");
                    if (inner) {
                        inner.style.transition = speed + "ms";
                    }
                }
            }
        }
    };

    if ($(".wpo-hero-slider .swiper-container").length) {
        new Swiper(".wpo-hero-slider .swiper-container", swiperOptions);
    } else if ($(".swiper-container").length) {
        new Swiper(".swiper-container", swiperOptions);
    }

    /*------------------------------------------
        = DATA BACKGROUND IMAGE
    -------------------------------------------*/
    $(".slide-bg-image").each(function () {
        const bg = $(this).data("background");
        if (bg) {
            $(this).css("background-image", "url(" + bg + ")");
        }
    });

    /*------------------------------------------
        = WOW ANIMATION
    -------------------------------------------*/
    const wow = new WOW({
        boxClass: "wow",
        animateClass: "animated",
        offset: 0,
        mobile: true,
        live: true
    });

    /*------------------------------------------
        = HIDE PRELOADER
    -------------------------------------------*/
    function preloader() {
        const $preloader = $(".preloader");
        if ($preloader.length) {
            $preloader.delay(100).fadeOut(500, function () {
                wow.init();
            });
        }
    }

    /*------------------------------------------
        = ACTIVE POPUP IMAGE (Fancybox)
    -------------------------------------------*/
    if ($(".fancybox").length) {
        $(".fancybox").fancybox({
            openEffect: "elastic",
            closeEffect: "elastic",
            wrapCSS: "project-fancybox-title-style"
        });
    }

    /*------------------------------------------
        = POPUP YOUTUBE, VIMEO, GMAPS
    -------------------------------------------*/
    if ($(".popup-youtube, .popup-vimeo, .popup-gmaps").length) {
        $(".popup-youtube, .popup-vimeo, .popup-gmaps").magnificPopup({
            type: "iframe",
            mainClass: "mfp-fade",
            removalDelay: 160,
            preloader: false,
            fixedContentPos: false
        });
    }

    /*------------------------------------------
        = POPUP VIDEO (Fancybox)
    -------------------------------------------*/
    if ($(".video-btn").length) {
        $(".video-btn").on("click", function (e) {
            e.preventDefault();
            $.fancybox({
                href: this.href,
                type: $(this).data("type"),
                title: this.title,
                helpers: {
                    title: { type: "inside" },
                    media: {}
                },
                beforeShow: function () {
                    $(".fancybox-wrap").addClass("gallery-fancybox");
                }
            });
        });
    }

    /*------------------------------------------
        = ACTIVE GALLERY POPUP IMAGE
    -------------------------------------------*/
    if ($(".popup-gallery").length) {
        $(".popup-gallery").magnificPopup({
            delegate: "a",
            type: "image",
            gallery: { enabled: true },
            zoom: {
                enabled: true,
                duration: 300,
                easing: "ease-in-out",
                opener: function (openerElement) {
                    return openerElement.is("img")
                        ? openerElement
                        : openerElement.find("img");
                }
            }
        });
    }

    /*------------------------------------------
        = SORTING GALLERY (Isotope)
    -------------------------------------------*/
    function sortingGallery() {
        if ($(".sortable-gallery .gallery-filters").length) {
            const $container = $(".gallery-container");
            $container.isotope({
                filter: "*",
                animationOptions: { duration: 750, easing: "linear", queue: false }
            });
            $(".gallery-filters li a").on("click", function (e) {
                e.preventDefault();
                $(".gallery-filters li .current").removeClass("current");
                $(this).addClass("current");
                const selector = $(this).attr("data-filter");
                $container.isotope({
                    filter: selector,
                    animationOptions: { duration: 750, easing: "linear", queue: false }
                });
            });
        }
    }
    sortingGallery();

    /*------------------------------------------
        = MASONRY GALLERY
    -------------------------------------------*/
    function masonryGridSetting() {
        if ($(".masonry-gallery").length) {
            const $grid = $(".masonry-gallery").masonry({
                itemSelector: ".grid-item",
                columnWidth: ".grid-item",
                percentPosition: true
            });
            $grid.imagesLoaded().progress(function () {
                $grid.masonry("layout");
            });
        }
    }

    /*------------------------------------------
        = FUNFACT / ODOMETER
    -------------------------------------------*/
    if ($(".odometer").length) {
        $(".odometer").appear();
        $(document.body).on("appear", ".odometer", function () {
            $(".odometer").each(function () {
                const countNumber = $(this).attr("data-count");
                $(this).html(countNumber);
            });
        });
    }

    /*------------------------------------------
        = STICKY HEADER
    -------------------------------------------*/
    function cloneNavForStickyMenu($ele, newElmClass) {
        $ele
            .addClass("original")
            .clone()
            .insertAfter($ele)
            .addClass(newElmClass)
            .removeClass("original");
    }

    if ($(".wpo-site-header .navigation").length) {
        cloneNavForStickyMenu($(".wpo-site-header .navigation"), "sticky-header");
    }

    let lastScrollTop = 0;

    function stickyMenu($targetMenu, toggleClass) {
        const st = $(window).scrollTop();
        if (st > 500) {
            $targetMenu.addClass(toggleClass);
        } else {
            $targetMenu.removeClass(toggleClass);
        }
        lastScrollTop = st;
    }

    /*------------------------------------------
        = HEADER SEARCH TOGGLE
    -------------------------------------------*/
    if ($(".header-search-form-wrapper").length) {
        const $searchToggleBtn = $(".search-toggle-btn");
        const $searchToggleBtnIcon = $(".search-toggle-btn i");
        const $searchContent = $(".header-search-form");

        $searchToggleBtn.on("click", function (e) {
            $searchContent.toggleClass("header-search-content-toggle");
            $searchToggleBtnIcon.toggleClass("fi flaticon-search fi ti-close");
            e.stopPropagation();
        });

        $body.on("click", function () {
            $searchContent.removeClass("header-search-content-toggle");
        });

        $searchContent.on("click", function (e) {
            e.stopPropagation();
        });
    }

    /*------------------------------------------
        = HEADER SHOPPING CART TOGGLE
    -------------------------------------------*/
    if ($(".mini-cart").length) {
        const $cartToggleBtn = $(".cart-toggle-btn");
        const $cartContent = $(".mini-cart-content");
        const $cartCloseBtn = $(".mini-cart-close");

        $cartToggleBtn.on("click", function (e) {
            $cartContent.toggleClass("mini-cart-content-toggle");
            e.stopPropagation();
        });

        $cartCloseBtn.on("click", function (e) {
            $cartContent.removeClass("mini-cart-content-toggle");
            e.stopPropagation();
        });

        $body.on("click", function () {
            $cartContent.removeClass("mini-cart-content-toggle");
        });

        $cartContent.on("click", function (e) {
            e.stopPropagation();
        });
    }

    /*------------------------------------------
        = RECENT CASE / SERVICE THUMBS
    -------------------------------------------*/
    if ($(".service-thumbs").length) {
        $(".service-thumb").on("click", function (e) {
            e.preventDefault();
            const target = $($(this).attr("data-case"));
            $(".service-thumb").removeClass("active-thumb");
            $(this).addClass("active-thumb");
            $(".service-content .service-data").hide(0);
            $(".service-data").fadeOut(300).removeClass("active-service-data");
            $(target).fadeIn(300).addClass("active-service-data");
        });
    }

    /*------------------------------------------
        = TESTIMONIAL SLIDER (OwlCarousel)
    -------------------------------------------*/
    if ($(".testimonial-slider").length) {
        $(".testimonial-slider").owlCarousel({
            autoplay: true,
            smartSpeed: 300,
            margin: 100,
            loop: true,
            autoplayHoverPause: true,
            dots: true,
            nav: false,
            items: 2,
            responsive: {
                0: { items: 1 },
                767: { items: 2 },
                1200: { items: 2 },
                1300: { items: 2 },
                1400: { items: 2 },
                1500: { items: 2 }
            }
        });
    }

    /*------------------------------------------
        = PARTNERS SLIDER (OwlCarousel)
    -------------------------------------------*/
    if ($(".partners-slider").length) {
        $(".partners-slider").owlCarousel({
            autoplay: true,
            smartSpeed: 300,
            margin: 30,
            loop: true,
            autoplayHoverPause: true,
            dots: false,
            nav: false,
            responsive: {
                0: { items: 2 },
                550: { items: 3 },
                992: { items: 4 },
                1200: { items: 5 }
            }
        });
    }

    /*------------------------------------------
        = CATEGORY SLIDER (OwlCarousel)
    -------------------------------------------*/
    if ($(".category-slider").length) {
        $(".category-slider").owlCarousel({
            autoplay: true,
            smartSpeed: 300,
            margin: 0,
            loop: true,
            autoplayHoverPause: true,
            dots: false,
            nav: false,
            responsive: {
                0: { items: 2 },
                550: { items: 3 },
                992: { items: 4 },
                1200: { items: 7 }
            }
        });
    }

    /*------------------------------------------
        = SERVICE ACTIVE SLIDER (OwlCarousel)
    -------------------------------------------*/
    if ($(".wpo-service-active").length) {
        $(".wpo-service-active").owlCarousel({
            autoplay: false,
            smartSpeed: 300,
            margin: 30,
            loop: true,
            autoplayHoverPause: true,
            dots: false,
            nav: true,
            navText: [
                '<i class="fi flaticon-left-arrow"></i>',
                '<i class="fi flaticon-right-arrow-1"></i>'
            ],
            responsive: {
                0: { items: 1, dots: true, nav: false },
                575: { items: 1 },
                767: { items: 2 },
                992: { items: 2 },
                1200: { items: 3 }
            }
        });
    }

    /*------------------------------------------
        = STATIC HERO IMAGE SLIDER (OwlCarousel)
    -------------------------------------------*/
    if ($(".static-hero-slide-img").length) {
        $(".static-hero-slide-img").owlCarousel({
            autoplay: true,
            smartSpeed: 300,
            margin: 10,
            loop: true,
            autoplayHoverPause: true,
            dots: false,
            nav: true,
            navText: [
                '<i class="fi flaticon-left-arrow"></i>',
                '<i class="fi flaticon-right-arrow-1"></i>'
            ],
            responsive: {
                0: { items: 1, dots: true, nav: false },
                575: { items: 1 },
                767: { items: 1 },
                992: { items: 2 },
                1200: { items: 3 }
            }
        });
    }

    /*------------------------------------------
        = PRODUCT ACTIVE SLIDER (OwlCarousel)
    -------------------------------------------*/
    if ($(".product-active").length) {
        $(".product-active").owlCarousel({
            autoplay: true,
            smartSpeed: 300,
            margin: 30,
            loop: true,
            autoplayHoverPause: true,
            dots: false,
            nav: true,
            navText: [
                '<i class="fi flaticon-left-arrow"></i>',
                '<i class="fi flaticon-right-arrow-1"></i>'
            ],
            responsive: {
                0: { items: 1, dots: true, nav: false },
                575: { items: 1 },
                767: { items: 2 },
                992: { items: 3 },
                1200: { items: 5 }
            }
        });
    }

    /*------------------------------------------
        = HERO ITEMS SLIDER (OwlCarousel)
    -------------------------------------------*/
    if ($(".wpo-hero-items").length) {
        $(".wpo-hero-items").owlCarousel({
            autoplay: true,
            smartSpeed: 300,
            margin: 30,
            loop: true,
            autoplayHoverPause: true,
            dots: true,
            nav: true,
            items: 3,
            navText: [
                '<i class="ti-arrow-left"></i>',
                '<i class="ti-arrow-right"></i>'
            ],
            responsive: {
                0: { items: 1, dots: true, nav: false },
                575: { items: 2 },
                767: { items: 2, dots: false },
                992: { items: 3, dots: false },
                1200: { items: 3 }
            }
        });
    }

    /*------------------------------------------
        = POST SLIDER (OwlCarousel)
    -------------------------------------------*/
    if ($(".post-slider").length) {
        $(".post-slider").owlCarousel({
            mouseDrag: false,
            smartSpeed: 500,
            margin: 30,
            loop: true,
            nav: true,
            navText: [
                '<i class="fi ti-arrow-left"></i>',
                '<i class="fi ti-arrow-right"></i>'
            ],
            dots: false,
            items: 1
        });
    }

    /*------------------------------------------
        = SHOP SINGLE PRODUCT SLIDER (Slick)
    -------------------------------------------*/
    function initShopSingleSlider() {
        if (!$(".shop-single-slider").length || typeof $.fn.slick === "undefined") return;
        try {
            $(".slider-for").slick({
                slidesToShow: 1,
                slidesToScroll: 1,
                arrows: false,
                fade: true,
                asNavFor: ".slider-nav"
            });
            $(".slider-nav").slick({
                slidesToShow: 5,
                slidesToScroll: 1,
                asNavFor: ".slider-for",
                vertical: true,
                verticalSwiping: true,
                focusOnSelect: true,
                arrows: false,
                responsive: [
                    { breakpoint: 500, settings: { slidesToShow: 3 } },
                    { breakpoint: 400, settings: { slidesToShow: 2 } }
                ]
            });
        } catch (err) {
            console.error("Shop single product slider failed:", err);
        }
    }

    /*------------------------------------------
        = COUNTDOWN CLOCK (Reusable)
    -------------------------------------------*/
    function initCountdown(selector, date, labels) {
        if (!$(selector).length || typeof $.fn.countdown === "undefined") return;
        $(selector).countdown(date, function (event) {
            $(this).html(
                '<div class="box"><div><div class="time">' + event.strftime("%D") + '</div><span>' + labels.days + '</span></div></div>' +
                '<div class="box"><div><div class="time">' + event.strftime("%H") + '</div><span>' + labels.hours + '</span></div></div>' +
                '<div class="box"><div><div class="time">' + event.strftime("%M") + '</div><span>' + labels.minutes + '</span></div></div>' +
                '<div class="box"><div><div class="time">' + event.strftime("%S") + '</div><span>' + labels.seconds + '</span></div></div>'
            );
        });
    }
    function initCountdown2(selector, date, labels) {
        if (!$(selector).length || typeof $.fn.countdown === "undefined") return;
        $(selector).countdown(date, function (event) {
            $(this).html(
                '<div class="box"><div><div class="time">' + event.strftime("%M") + '</div><span>' + labels.month + '</span></div></div>' +
                '<div class="box"><div><div class="time">' + event.strftime("%D") + '</div><span>' + labels.days + '</span></div></div>' +
                '<div class="box"><div><div class="time">' + event.strftime("%H") + '</div><span>' + labels.hours + '</span></div></div>' +
                '<div class="box"><div><div class="time">' + event.strftime("%M") + '</div><span>' + labels.minutes + '</span></div></div>' +
                '<div class="box"><div><div class="time">' + event.strftime("%S") + '</div><span>' + labels.seconds + '</span></div></div>'
            );
        });
    }

    /*------------------------------------------
        = PRODUCT QUANTITY (TouchSpin)
    -------------------------------------------*/
    function initProductQuantity() {
        if ($("input[name='product-count']").length && typeof $.fn.TouchSpin !== "undefined") {
            $("input[name='product-count']").TouchSpin({ verticalbuttons: true });
        }
    }

    /*------------------------------------------
        = PRICE RANGE SLIDER (jQuery UI)
    -------------------------------------------*/
    function initPriceSlider() {
        if (!$("#slider-range").length || typeof $.fn.slider === "undefined") return;
        $("#slider-range").slider({
            range: true,
            min: 12,
            max: 200,
            values: [20, 100],
            slide: function (event, ui) {
                $("#amount").val("$" + ui.values[0] + " - $" + ui.values[1]);
            }
        });
        $("#amount").val(
            "$" + $("#slider-range").slider("values", 0) +
            " - $" + $("#slider-range").slider("values", 1)
        );
    }

    /*------------------------------------------
        = CART PLUS / MINUS BUTTONS
    -------------------------------------------*/
    function initCartButtons() {
        if (!$(".cart-plus-minus").length) return;
        $(".cart-plus-minus").append(
            '<div class="dec qtybutton">-</div><div class="inc qtybutton">+</div>'
        );
        $(".cart-plus-minus").on("click", ".qtybutton", function () {
            const $input = $(this).siblings("input");
            let oldVal = parseFloat($input.val()) || 0;
            let newVal = $(this).hasClass("inc") ? oldVal + 1 : Math.max(0, oldVal - 1);
            $input.val(newVal).trigger("change");
        });
    }

    /*------------------------------------------
        = BACK TO TOP BUTTON
    -------------------------------------------*/
    $body.append("<a href='#' class='back-to-top'><i class='ti-arrow-up'></i></a>");

    function toggleBackToTopBtn() {
        const amountScrolled = 1000;
        if ($(window).scrollTop() > amountScrolled) {
            $("a.back-to-top").fadeIn("slow");
        } else {
            $("a.back-to-top").fadeOut("slow");
        }
    }

    $("a.back-to-top").on("click", function (e) {
        e.preventDefault();
        $("html, body").animate({ scrollTop: 0 }, 700);
    });

    /*------------------------------------------
        = CONTACT FORM
    -------------------------------------------*/
    function initContactForm() {
        const $form = $("#contact-form-main");
        if (!$form.length || typeof $.fn.validate === "undefined") return;

        $form.validate({
            rules: {
                name: { required: true, minlength: 2 },
                email: { required: true, email: true },
                phone: { required: true },
                adress: { required: true },
                guest: { required: true },
                meal: { required: true },
                date: { required: true },
                what: { required: true },
                service: { required: true }
            },
            messages: {
                name: "Ingresa tu nombre.",
                email: { required: "Ingresa tu correo electrónico.", email: "Ingresa un correo electrónico válido." },
                phone: "Ingresa tu número telefónico.",
                adress: "Ingresa tu dirección.",
                guest: "Selecciona el número de invitados.",
                meal: "Selecciona una opción de menú.",
                date: "Selecciona una fecha.",
                what: "Selecciona un motivo.",
                service: "Selecciona un evento."
            },
            submitHandler: function (form) {
                $.ajax({
                    type: "POST",
                    url: "mail-contact.php",
                    data: $(form).serialize(),
                    dataType: "json",
                    beforeSend: () => $("#loader").show(),
                    success: function (response) {
                        $("#loader").hide();
                        if (response.status === "success") {
                            $("#success").slideDown("slow").delay(3000).slideUp("slow");
                            form.reset();
                        } else {
                            $("#error").text(response.message || "No se pudo enviar el formulario.")
                                .slideDown("slow").delay(3000).slideUp("slow");
                        }
                    },
                    error: function () {
                        $("#loader").hide();
                        $("#error").text("Error del servidor. Inténtalo de nuevo más tarde.")
                            .slideDown("slow").delay(3000).slideUp("slow");
                    }
                });
                return false;
            }
        });
    }

    /*==========================================================================
        WHEN DOCUMENT LOADS
    ==========================================================================*/
    $(window).on("load", function () {
        preloader();
        sortingGallery();
        toggleMobileNavigation();
        masonryGridSetting();
        smallNavFunctionality();
        smoothScrolling(
            $("#navbar > ul > li > a[href^='#'], .preview-middle-text a.scrool[href^='#']"),
            $(".wpo-site-header .navigation, .site-header .nav").innerHeight()
        );
        initShopSingleSlider();
        initProductQuantity();
        initPriceSlider();
        initCartButtons();
        initCountdown("#clock", "2026-11-21 14:00:00", {
            days: "Días", hours: "Horas", minutes: "Minutos", seconds: "Segundos"
        });
        initCountdown2("#clock2", "2026-11-21 14:00:00", {
            month: "Mes", days: "Días", hours: "Horas", minutes: "Minutos", seconds: "Segundos"
        });
        initContactForm();
    });

    /*==========================================================================
        WHEN WINDOW SCROLLS
    ==========================================================================*/
    $(window).on("scroll", function () {
        if ($(".wpo-site-header").length) {
            stickyMenu($(".wpo-site-header .navigation"), "sticky-on");
        }
        toggleBackToTopBtn();
        activeMenuItem($(".navigation-holder"));
    });

    /*==========================================================================
        WHEN WINDOW RESIZES
    ==========================================================================*/
    $(window).on(
        "resize",
        debounce(function () {

            bgParallax();

            toggleClassForSmallNav();

            smallNavFunctionality();

        }, 200)
    );

})(window.jQuery);
