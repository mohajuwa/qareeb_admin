"use strict";

(function ($) {
  "use strict";

  /*------------------------------------------------------------------
  [Table of contents]
    ZUZU PRELOADER JS INIT
  ZUZU SCROLL TOP JS INIT
  ZUZU STICKY MENU JS INIT
  ZUZU COUNTER JS INIT
  ZUZU CLIENT SLIDER INIT
  ZUZU TESTIMONIAL SLIDER INIT
  ZUZU MAGNIFIC POPUP JS INIT
  ZUZU CARD SLIDER INIT
  ZUZU TEXT SLIDER INIT
  ZUZU CARD SLIDER 02 INIT
  ZUZU MAP JS INIT
  
  -------------------------------------------------------------------*/

  /*--------------------------------------------------------------
  CUSTOM PRE DEFINE FUNCTION
  ------------------------------------------------------------*/
  /* is_exist() */
  jQuery.fn.is_exist = function () {
    return this.length;
  };
  $(function () {
    /*--------------------------------------------------------------
    ZUZU PRELOADER JS INIT
    --------------------------------------------------------------*/

    $(".ppc-preloader").fadeOut(500);

    /*--------------------------------------------------------------
    ZUZU SCROLL TOP JS INIT
    --------------------------------------------------------------*/
    //Scroll event
    $(window).scroll(function () {
      var scrolled = $(window).scrollTop();
      if (scrolled > 200) $('.ppc-go-top').fadeIn('slow');
      if (scrolled < 200) $('.ppc-go-top').fadeOut('slow');
    });

    //Click event
    $('.ppc-go-top').click(function () {
      $("html, body").animate({
        scrollTop: "0"
      }, 500);
    });

    /*--------------------------------------------------------------
    ZUZU STICKY MENU JS INIT
    --------------------------------------------------------------*/
    $(window).on('scroll', function () {
      if ($(window).scrollTop() > 50) {
        $('#sticky-menu').addClass('sticky-menu');
      } else {
        $('#sticky-menu').removeClass('sticky-menu');
      }
    });

    /*--------------------------------------------------------------
    ZUZU COUNTER JS INIT
    --------------------------------------------------------------*/
    var zuzu_counter = $('#ppc-counter');
    if (zuzu_counter.is_exist()) {
      var a = 0;
      $(window).scroll(function () {
        var oTop = $(zuzu_counter).offset().top - window.innerHeight;
        if (a == 0 && $(window).scrollTop() > oTop) {
          $('.ppc-counter').each(function () {
            var $this = $(this),
              countTo = $this.attr('data-percentage');
            $({
              countNum: $this.text()
            }).animate({
              countNum: countTo
            }, {
              duration: 4000,
              easing: 'swing',
              step: function step() {
                $this.text(Math.floor(this.countNum));
              },
              complete: function complete() {
                $this.text(this.countNum);
              }
            });
          });
          a = 1;
        }
      });
    }

    /*--------------------------------------------------------------
    ZUZU CLIENT SLIDER INIT
    --------------------------------------------------------------*/
    var zuzu_client_slider = $('.ppc-client-slider');
    if (zuzu_client_slider.is_exist()) {
      zuzu_client_slider.slick({
        infinite: true,
        slidesToShow: 5,
        slidesToScroll: 1,
        arrows: false,
        dots: false,
        autoplay: true,
        autoplaySpeed: 0,
        speed: 10000,
        cssEase: 'linear',
        pauseOnHover: true,
        adaptiveHeight: true,
        responsive: [{
          breakpoint: 1199,
          settings: {
            slidesToShow: 4
          }
        }, {
          breakpoint: 991,
          settings: {
            slidesToShow: 3
          }
        }, {
          breakpoint: 767,
          settings: {
            slidesToShow: 2
          }
        }]
      });
    }

    /*--------------------------------------------------------------
    ZUZU TESTIMONIAL SLIDER INIT
    --------------------------------------------------------------*/
    var zuzu_testimonial_slider = $('.ppc-testimonial-slider');
    if (zuzu_testimonial_slider.is_exist()) {
      zuzu_testimonial_slider.slick({
        infinite: true,
        slidesToShow: 3,
        slidesToScroll: 1,
        centerPadding: '180px',
        arrows: false,
        dots: true,
        centerMode: true,
        autoplay: false,
        autoplaySpeed: 2000,
        responsive: [{
          breakpoint: 1499,
          settings: {
            slidesToShow: 2
          }
        }, {
          breakpoint: 1200,
          settings: {
            slidesToShow: 2,
            centerPadding: '100px'
          }
        }, {
          breakpoint: 991,
          settings: {
            slidesToShow: 2,
            centerPadding: '70px'
          }
        }, {
          breakpoint: 850,
          settings: {
            slidesToShow: 1,
            centerPadding: '70px'
          }
        }, {
          breakpoint: 600,
          settings: {
            slidesToShow: 1,
            centerPadding: '0'
          }
        }]
      });
    }

    /*--------------------------------------------------------------
    ZUZU MAGNIFIC POPUP JS INIT
    ------------------------------------------------------------*/
    var popup_youtube = $('.ppc-popup');
    if (popup_youtube.is_exist()) {
      popup_youtube.magnificPopup({
        type: 'iframe',
        mainClass: 'mfp-fade'
      });
    }

    /*--------------------------------------------------------------
    ZUZU CARD SLIDER INIT
    --------------------------------------------------------------*/
    var zuzu_card_slider = $('.ppc-card-slider');
    if (zuzu_card_slider.is_exist()) {
      zuzu_card_slider.slick({
        infinite: true,
        slidesToShow: 6,
        slidesToScroll: 1,
        arrows: false,
        dots: false,
        autoplay: true,
        autoplaySpeed: 0,
        speed: 10000,
        cssEase: 'linear',
        pauseOnHover: true,
        adaptiveHeight: true,
        responsive: [{
          breakpoint: 1400,
          settings: {
            slidesToShow: 3,
            slidesToScroll: 1,
            infinite: true
          }
        }, {
          breakpoint: 992,
          settings: {
            slidesToShow: 2,
            slidesToScroll: 1
          }
        }, {
          breakpoint: 575,
          settings: {
            slidesToShow: 1,
            slidesToScroll: 1,
            arrows: false
          }
        }]
      });
    }

    /*--------------------------------------------------------------
    ZUZU TEXT SLIDER INIT
    --------------------------------------------------------------*/
    var zuzu_text_slider = $('.ppc-text-slider');
    if (zuzu_text_slider.is_exist()) {
      zuzu_text_slider.slick({
        infinite: true,
        slidesToShow: 2,
        slidesToScroll: 1,
        arrows: false,
        dots: false,
        autoplay: true,
        autoplaySpeed: 0,
        speed: 10000,
        cssEase: 'linear',
        pauseOnHover: true,
        adaptiveHeight: true,
        responsive: [{
          breakpoint: `1400`,
          settings: {
            slidesToShow: 1,
            slidesToScroll: 1
          }
        }]
      });
    }

    /*--------------------------------------------------------------
    ZUZU CARD SLIDER 02 INIT
    --------------------------------------------------------------*/
    var zuzu_card_slider2 = $('.ppc-card-slider2');
    if (zuzu_card_slider2.is_exist()) {
      zuzu_card_slider2.slick({
        infinite: true,
        slidesToShow: 1,
        slidesToScroll: 1,
        arrows: true,
        autoplay: true,
        autoplaySpeed: 2000,
        prevArrow: '<button class="slide-arrow prev-arrow"></button>',
        nextArrow: '<button class="slide-arrow next-arrow"></button>'
      });
    }
  }); /*End document ready*/

  $(window).on("resize", function () {}); // end window resize

  $(window).on("load", function () {}); // End window LODE

  /*--------------------------------------------------------------
  ZUZU MAP JS INIT
  ------------------------------------------------------------*/
  var google_map = $('#map');
  if (google_map.is_exist()) {
    var init = function init() {
      var mapOptions = {
        zoom: 11,
        scrollwheel: false,
        navigationControl: false,
        mapTypeControl: false,
        scaleControl: false,
        draggable: true,
        disableDefaultUI: true,
        center: new google.maps.LatLng(40.6700, -73.9400),
        styles: [{
          "featureType": "landscape.man_made",
          "elementType": "geometry",
          "stylers": [{
            "color": "#f7f1df"
          }]
        }, {
          "featureType": "landscape.natural",
          "elementType": "geometry",
          "stylers": [{
            "color": "#d0e3b4"
          }]
        }, {
          "featureType": "landscape.natural.terrain",
          "elementType": "geometry",
          "stylers": [{
            "visibility": "off"
          }]
        }, {
          "featureType": "poi",
          "elementType": "labels",
          "stylers": [{
            "visibility": "off"
          }]
        }, {
          "featureType": "poi.business",
          "elementType": "all",
          "stylers": [{
            "visibility": "off"
          }]
        }, {
          "featureType": "poi.medical",
          "elementType": "geometry",
          "stylers": [{
            "color": "#fbd3da"
          }]
        }, {
          "featureType": "poi.park",
          "elementType": "geometry",
          "stylers": [{
            "color": "#bde6ab"
          }]
        }, {
          "featureType": "road",
          "elementType": "geometry.stroke",
          "stylers": [{
            "visibility": "off"
          }]
        }, {
          "featureType": "road",
          "elementType": "labels",
          "stylers": [{
            "visibility": "off"
          }]
        }, {
          "featureType": "road.highway",
          "elementType": "geometry.fill",
          "stylers": [{
            "color": "#ffe15f"
          }]
        }, {
          "featureType": "road.highway",
          "elementType": "geometry.stroke",
          "stylers": [{
            "color": "#efd151"
          }]
        }, {
          "featureType": "road.arterial",
          "elementType": "geometry.fill",
          "stylers": [{
            "color": "#ffffff"
          }]
        }, {
          "featureType": "road.local",
          "elementType": "geometry.fill",
          "stylers": [{
            "color": "black"
          }]
        }, {
          "featureType": "transit.station.airport",
          "elementType": "geometry.fill",
          "stylers": [{
            "color": "#cfb2db"
          }]
        }, {
          "featureType": "water",
          "elementType": "geometry",
          "stylers": [{
            "color": "#a2daf2"
          }]
        }]
      };
      var mapElement = document.getElementById('map');
      var map = new google.maps.Map(mapElement, mapOptions);
      var marker = new google.maps.Marker({
        position: new google.maps.LatLng(40.6700, -73.9400),
        map: map,
        icon: 'assets/images/all-img/contact/map.png',
        title: 'zuzu'
      });
      var contentString = '<div id="content">' + '<div id="tpw">' + '<h3>zuzu' + '</div>';
      var infowindow = new google.maps.InfoWindow({
        content: contentString,
        maxWidth: 280
      });
      marker.setAnimation(google.maps.Animation.BOUNCE);
      setTimeout(function () {
        marker.setAnimation(null);
      }, 750); //time it takes for one bounce   

      google.maps.event.addListener(marker, 'click', function () {
        infowindow.open(map, marker);
      });
    };
    google.maps.event.addDomListener(window, 'load', init);
  }

  // wow js
  var wow = new WOW({
    mobile: false,
    // default
    tablet: false
  });
  wow.init();
})(jQuery);