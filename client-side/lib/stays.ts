import type { StayKind } from "./booking";

export type GalleryShot = {
  src: string;
  alt: string;
  caption: string;
};

export type Review = {
  name: string;
  initials: string;
  stayed: string;
  quote: string;
  tone: "clay" | "sage" | "sand";
};

export type Stay = {
  slug: string;
  name: string;
  wing: string;
  kind: StayKind;
  kindLabel: string;
  petFriendly: boolean;
  price: number;
  maxGuests: number;
  occupancy: string;
  bedIcon: string;
  blurb: string;
  amenities: string[];
  highlight: { icon: string; label: string };
  rating: number;
  reviewCount: number;
  eyebrow: string;
  intro: string;
  image: string;
  imageAlt: string;
  gallery: GalleryShot[];
  facts: { icon: string; label: string; value: string }[];
  story: string[];
  reviews: Review[];
};

const scene = {
  hostsVeranda:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCCHi6UFkrFm-BsrJDUHIEY5SNJPVVygbs-JabWIWVjlaKTUgXWiEIYlunIjFg0rSmBPboOHlgMj39T2eSSOT7EkLlLlotMt3Ml0VQ-H4uuZd795YgqNT0JrfGFn32tvocCMFZUUzXCaf6p4B5A_FeaKCjp1OMaAKS2YVeTXHIE6G_VkP4bnO6AxL_hJYbG1_w1qeTMPYbUr2QSlis82P6eTTJuADaP8KF2XHb65SbJCZP0B6NdRjYU",
  hostsPortrait:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBMgV16m5Vg-n38ORIaQe_IidYACn8d2DwL2kunbcSOa08FLttNGrorX-WOWHQJ8yjZFT1pH_w84gdIaq_Swv4-Q7sRXVK6BAzMMa6_HcEmiPMagk3w-O76urOSLbSSQi_x1BOpfd72336jO6l4mzPFKU5CcSLcVgifz1Rsq0SY8I9ir79bk5KWjEmTbh5_IY9TwSD3dis_q1zeHlcM0R2IRoCZql-6zpUbLIgXCJgHqQ3rvsGYxjZg",
  teaGardenPatio:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBPbo-ppKvLPABVngySmWovKSGVio5EvMRRDu2pb8tn062eOlVXEzm62w-zu1LI_NF4YqY8Yl_g7vOZ5plQHCoWQemlrDVhFlIwJxeIA_wZgvD6QoP0jNIzVaikRNCxiFIRmkXsCbHdIJRKcq7TkUmP3EGmQ2ox0ImPOrY_NkmPpdw7l7Jgg3iCdZajC-i0l_nGm-XY91PCau_I_G0uobbTfwhqPmcdnVFGC5W1UJnucZHUw9V2uAEP",
  breakfastTable:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDx5qrECwuU10zbmofVV1D-DPWAblVUwkdaYkFomHfZpsNcUnz-GNq4zwfiZEg_he2KyuPHovGLXvy06q32as1loRO3cRAzGrNlw9F6eregBAHiTy36fzcdXtG2Cv2wt_5D_wacdOmnJvKG6SimJLuNdTSzskHO1378TV5HzDINdqaWfKFyBgE3lt3ULXEIop3T7DlNIzgw4UyYD1HgsTW-DwJH9_8BMd7wCMlWaC32EXZkm6FJLs-5",
  timberJoinery:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDkkNzhbvlU8E_aJ4oUrndjSjlB0Ga8NyCGWxUrHIpaiveRbb-zOTnyzaCjOTfGm1zqVUpeQn-BArJybguyCnnB3mdnMi9XOhnLgdZ0_OUDQPw300oamTh-6DxPJ58keDCirYFqUt4R45gDPkbgxF_fuI0cMqrjSvPT7mT9rv-vJAltWOfmm-qsoB_pKes8n5EINCXe1nHic5OrEjo9usIhLaimGVaH_3BlQmwyU790UPkiqBi_wGYI",
  readingRoom:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuC257E05UXqlGZPoOvZNwCtDYk5VtQesH8blN30eogwlB3g9ekrW4W42VazJyr7Lq8xUEfVG9RdTNILO8DyFvb7P4Vc6jW2MPPQXu7EYtixH-lnz5s9wD5p2DtI5uKC9yrFRn3i9QGYGDPP491RKxbmFsdN0wt0QjKFqC8OENDBeTiYIiIHzTX0KHqoFlT6HPVcP2_E1GB1prwA3P93qzzv9aWIv7ZM9_f0IPSdZo9ja0d2IlLYRW9E",
  bathingRoom:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAQqR86iPdNVpd6ywlguUiiHJ5fZ7wybil7znUG4U1GVxwkCbQuaFEcqy7cqtqwWGPD-f4gWZyh8GqdXdvTVyotOeg60QqEnwWHnNapBVcUTAWySqnMH4bChOnXHbzkWPIyh0BdkT8OsyeVaqioVmKL234EsGo5CDf7Ug22gEW1TglIlNUeqt2yS3HVIfrjqJVNvw0O7NkQxAOUN-PlzLhIsGEMteKOj6xswYZWms39YwGcyiAz_QNm",
  glenburnAlt:
    "Glenburn Burra Bungalow: a colonial four-poster bed under a high ceiling, with a balcony opening onto Kanchenjunga.",
};

const cover = {
  glenburn:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDcfzIQmrIltYDJhAxlcR86qZT7j2IaI_7SuxyZASGs4Y8yruKVNhyn0y7yjgpfAUr7Jmj4pk3rFp0GGi_DAAffa1YpycHnPBYPe5vVgBvgX-XrjneGe_N4GI38JRyfEL2WO_dWxjnlhIYFmpwP5BngP1_BwnCrX403yefAwuWf-_Iyup-CrRrMQpXCbkOqhHSAvD3XeEWYEPn2-UX9ouKqKVYI41re1dohSRLfNKL7zUSDHSgNnUcv",
  makaibari:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDhevMSJ8jcLv6V72NY3iIZ51nkiD7w9G6-wl0akdHXPKnsjgiyQeKyvzNMz9DdhaqzMrtuQOUN7mAaXsxcrMMhrgn0wPrOzmeEZm_2xJDhGp6PU3VtbnLwL5267C9IGr7xH9-X69z17q5sW_oGxG6-PSUco5LG4vCqeZNbujLc4O0AtdgR5S9b4i5sA0yH1oiCMsIle5HBm8fZtEC704hHjmy2xQV1Vszg6-0jdTnIoV5ggRkBes2o",
  tumsong:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAzMTDC3NwT48_J_LOVuHXiwGKrJKmOrUu_aaxRgQ8Ipl-hkJZOnFUQHlX6BlW4wqfsb3me0y16oEkWh7ACTU6AQxj6q3TLB_-Db3vmMAU130aLKcb1v3NMWeOrHKPoMikR0-k0cbIX0wS3X1P3XGuvN3dzcxohQAlGIyNY_I2T7X3BbyscNihYTS25W6SjcRDwPdtUq1WyP7ODI_X9qB6UkU_dL8o8evjn498C_0op4mKDkVk3ubZl",
  takdah:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAR5QBCt_FngLzPy_7tfAtCAlJ554XzvlMYT7kp5kWSuS3ME_2vUfZSp568KqvPDWrFWLK_vg1SlROOW-4Q_D8NFqVqOAAcpyar7jVaoQJ5u02A_7ptSj7YlTO3unLjVF0hV82w-KomqvQNkiDvW6LLbtAgEyNF-tDdedyoN8rQdKJdD9eVRob1dHQvqId34dTJFmQwNPvTN0gxwHkKKXE9td1vqUmSkVhGWWSmdmnvlu66dq_Noypt",
  nembang:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDxTjO6qBFZSPJyNG0A48aa1z4xyt5NRwWzM24IAeC9WkPZzaCk_ZxB0Bs3Ojp286sLcrhQTQSAtg5rVGf7Kv2VlGvLgmGk0ZrVAyE8qxZXJKa-KDdNF4jP7umPXz8bPwWtdSaSeuEunHx6vUQ6tA27NFcdh-KedhbrAgByaM3sUNUbgkgc_RNneHcADcKUW1d3evtjqeRa2OoOh55Jg4mHgGyGDZcXScOAI7rQ0XZOeHoEzOAw3ce_",
  dorjeHill:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDdgQpd8CsHDJFkCLfk4GPjApsAqTwVWmLTHio3LS4_tW_EN6ajwrZa6DJZ4HBt1nIAhQUXRGItdWwEsrI3mir_oIhXr4OtCRT1AHyp5i0q1foXWUoyW5GEGacNZEQXtzlnUd6Vsg1bvs0rAeWJGmARwu7Xgq6Ph8U8AtuGBpWPk15yJCjKDOf_IA2lw27OnjIRv989jUzHpddmQYSKjLxFW9uTdY0tbjj_5UBnvy2Yxxxf2IZVh5cO",
};

const shot = (alt: string, caption: string, src: string): GalleryShot => ({
  src,
  alt,
  caption,
});

/**
 * Rates are the published per-night tariffs for each property, in INR. Where a
 * property quotes a room category, the entry price is used and the range is noted
 * in the blurb. All prices are per room per night on the meal plan stated.
 */
export const stays: Stay[] = [
  {
    slug: "glenburn-tea-estate",
    name: "Glenburn Tea Estate",
    wing: "Burra Bungalow · Kurseong Road",
    kind: "estate",
    kindLabel: "Tea Estate Bungalow",
    petFriendly: false,
    price: 18000,
    maxGuests: 8,
    occupancy: "4 Rooms • Up to 8 Guests",
    bedIcon: "king_bed",
    blurb:
      "The 1859 Scottish tea estate in the Golden Valley, taken over by the Husain Ali family in 2003. Rates run ₹18,000–₹28,000 per night, all meals, activities and the whole 1,600-acre estate included.",
    amenities: ["All Meals & Beverages", "Private Estate", "Dawn Tea Picking"],
    highlight: { icon: "emoji_food_beverage", label: "Fully Inclusive Plan" },
    rating: 4.9,
    reviewCount: 86,
    eyebrow: "The Heritage Estate",
    intro:
      "A 1,600-acre working tea estate 35 km from Darjeeling town, running from 3,700 feet down to the sandy banks of the Rungeet. Four bedrooms in the Burra Bungalow, eight in all across two bungalows, and the entire estate to yourselves.",
    image: cover.glenburn,
    imageAlt: scene.glenburnAlt,
    gallery: [
      {
        src: cover.glenburn,
        alt: "The Burra Bungalow veranda at Glenburn, with a colonial four-poster bed and a balcony over the valley.",
        caption: "The Burra Bungalow, built 1859",
      },
      shot(
        "Terraced tea bushes running down a hillside slope in the early morning light.",
        "First flush on the estate slopes",
        scene.teaGardenPatio,
      ),
      shot(
        "A breakfast table laid with eggs, bread, fruit and hot tea on a wooden veranda.",
        "All meals, served family-style",
        scene.breakfastTable,
      ),
      shot(
        "Carved timber ceiling beams and moulded architraves in a colonial drawing room.",
        "Colonial detailing, kept intact",
        scene.timberJoinery,
      ),
      shot(
        "A wood-panelled library and sitting room with deep leather armchairs.",
        "The estate library",
        scene.readingRoom,
      ),
    ],
    facts: [
      { icon: "group", label: "Capacity", value: "8 Guests" },
      { icon: "bed", label: "Bedding", value: "4 Double Rooms" },
      { icon: "bathtub", label: "Bath", value: "Bathtub & Shower" },
      { icon: "location_on", label: "Altitude", value: "3,700 ft" },
    ],
    story: [
      "Founded in 1859 under Scottish ownership, Glenburn was one of the great Darjeeling estates before the industry collapsed around it. The Husain Ali family took over the bungalow operation in 2003 and have kept the Burra Bungalow — four rooms, the original colonial house — and the newer Water Lily Bungalow by the river as the only places guests sleep. Eight rooms in total is the entire capacity, which is why the estate books out six to eight months ahead in peak season.",
      "The stay is not a room with a view, it is the run of the place: pre-dawn tea picking with the head plucker, a private tour of the factory during processing hours, walks along the river and through private forest, a jeep ride to the Kanchenjunga viewpoint, and three-course candle-lit dinners cooked by the bungalow team. The nightly rate covers all of it, including chauffeur transfers from Bagdogra airport or New Jalpaiguri station and a car at your disposal for the length of the stay.",
    ],
    reviews: [
      {
        name: "Ananya & Rohan Deshpande",
        initials: "AD",
        stayed: "April 2026 • Stayed 5 nights",
        quote:
          "We were picked up from the airport and did not touch a suitcase until we left. The 5am plucking with the head plucker is the thing I will remember for the rest of my life. Worth every rupee of the rate.",
        tone: "clay",
      },
      {
        name: "Meera & Karl Lindström",
        initials: "ML",
        stayed: "November 2025 • Honeymoon, 6 nights",
        quote:
          "Eight rooms in the whole estate, and we had the Burra Bungalow to ourselves. The Kanchenjunga view from the balcony at first light is the reason we have already rebooked for next October.",
        tone: "sage",
      },
      {
        name: "Dr. Priyanka Shastri",
        initials: "PS",
        stayed: "March 2026 • Stayed 3 nights",
        quote:
          "The factory tour during processing hours, with the tasting at the end, is the best thing I have done in tea country. The team made us feel like house guests rather than guests.",
        tone: "sand",
      },
    ],
  },
  {
    slug: "makaibari-tea-estate",
    name: "Makaibari Tea Estate",
    wing: "Banerjee Family Homestay · Kurseong",
    kind: "estate",
    kindLabel: "Tea Estate Bungalow",
    petFriendly: false,
    price: 12000,
    maxGuests: 6,
    occupancy: "3 Rooms • Up to 6 Guests",
    bedIcon: "bed",
    blurb:
      "The world's first biodynamic-certified tea estate, certified 1988 and worked by the Banerjee family for four generations. ₹12,000–₹18,000 per night, staying in village homes inside the estate and eating with the family.",
    amenities: ["All Meals with Family", "Biodynamic Estate Walk", "Private Factory Visit"],
    highlight: { icon: "spa", label: "Quieter, More Authentic" },
    rating: 4.9,
    reviewCount: 64,
    eyebrow: "Biodynamic Village Homestay",
    intro:
      "Less luxury than Glenburn and considerably more authentic: a genuine family homestay inside a working biodynamic tea estate, where guests sleep in village homes on the estate boundary and eat in the Banerjee family house.",
    image: cover.makaibari,
    imageAlt:
      "A village guesthouse on a Darjeeling tea estate with a low roof, a wooden veranda and green slopes rising behind it.",
    gallery: [
      {
        src: cover.makaibari,
        alt: "Guest rooms in a village home on the estate, with a wooden veranda looking onto tea slopes.",
        caption: "Village homes within the estate boundary",
      },
      shot(
        "Neatly clipped tea bushes in long rows following the contour of the slope.",
        "Biodynamic terraces, no chemical inputs",
        scene.teaGardenPatio,
      ),
      shot(
        "A simple meal of rice, dal, vegetables and fish served on steel plates on a wooden floor.",
        "Dinner with the Banerjee family",
        scene.breakfastTable,
      ),
      shot(
        "A village house interior with timber-framed walls, a low ceiling and handloom cotton bedding.",
        "Simple, clean, unmistakably Nepali",
        scene.timberJoinery,
      ),
      shot(
        "Guests walking between village homes along a dirt track with the hills beyond.",
        "Meet the estate village",
        scene.hostsVeranda,
      ),
    ],
    facts: [
      { icon: "group", label: "Capacity", value: "6 Guests" },
      { icon: "bed", label: "Bedding", value: "3 Double Rooms" },
      { icon: "restaurant", label: "Meals", value: "All Meals Included" },
      { icon: "location_on", label: "Altitude", value: "2,000–4,500 ft" },
    ],
    story: [
      "Makaibari was founded in 1859 and in 1988 became the first tea estate in the world to be certified biodynamic — no chemical inputs anywhere on the slope. The Banerjee family have worked it for four generations, and the homestay programme puts guests into the actual village homes inside the estate boundary rather than a purpose-built hotel. There is no private dining room and no room service; you eat what the family eats, at the family table, when the family eats.",
      "What you get in exchange for the polish is a genuine working tea operation and a household that has been hosting visitors for decades. The tea-picking and factory experiences are arguably better here than anywhere else on the Darjeeling circuit precisely because it is a real biodynamic estate rather than a showcase. Rates start at ₹12,000 per night including all meals and activities, and booking three to four months ahead is sensible in peak season.",
    ],
    reviews: [
      {
        name: "Sneha Balakrishnan",
        initials: "SB",
        stayed: "February 2026 • Stayed 4 nights",
        quote:
          "No private dining room, no room service, and it was the best food I have eaten in Darjeeling. Eating with the family, hearing the estate stories over dinner — this is the real thing.",
        tone: "sage",
      },
      {
        name: "James & Fiona Whitlock",
        initials: "JW",
        stayed: "December 2025 • Stayed 6 nights",
        quote:
          "The rooms are simple and spotless. If you were expecting a five-star resort you will be disappointed; if you came for the tea and the people, you will not want to leave.",
        tone: "clay",
      },
      {
        name: "Arjun Mohanty",
        initials: "AM",
        stayed: "March 2026 • Stayed 3 nights",
        quote:
          "The biodynamic certification is not a marketing line, you can see it in how the estate is worked. The family took us through the whole day of plucking and sorting. Exceptional value at this rate.",
        tone: "sand",
      },
    ],
  },
  {
    slug: "tumsong-tea-retreat",
    name: "Tumsong Tea Retreat",
    wing: "Burra Sahib Bungalow · Tumsong",
    kind: "heritage",
    kindLabel: "Heritage Bungalow",
    petFriendly: false,
    price: 4500,
    maxGuests: 3,
    occupancy: "1 Valley Abode • Up to 3 Guests",
    bedIcon: "king_bed",
    blurb:
      "A 150-year-old Burra Sahib bungalow inside Tumsong Tea Estate, run by the Chamong group. Valley Abodes from ₹4,500 and Mount Kanchenjunga-facing rooms from ₹8,000 per night.",
    amenities: ["Heritage Bungalow", "Kanchenjunga View", "Guided Tea Garden Tour"],
    highlight: { icon: "landscape", label: "Kanchenjunga Facing" },
    rating: 4.8,
    reviewCount: 112,
    eyebrow: "Colonial Heritage",
    intro:
      "The Burra Sahib's own bungalow — the house the estate manager lived in — restored and opened to guests, with the most reliable Kanchenjunga view in the Tumsong valley. The classic mid-range way to do a tea estate night.",
    image: cover.tumsong,
    imageAlt:
      "A restored colonial bungalow room in Darjeeling with a four-poster bed, a writing desk and tall shuttered windows.",
    gallery: [
      {
        src: cover.tumsong,
        alt: "A restored Burra Sahib bungalow room with tall shutters opening onto the tea estate.",
        caption: "The estate manager's own house",
      },
      shot(
        "The snow line of Mount Kanchenjunga catching first light above a tea estate in the foreground.",
        "First light on Kanchenjunga",
        scene.teaGardenPatio,
      ),
      shot(
        "A laid breakfast table on a veranda with the valley dropping away beyond the railing.",
        "Breakfast on the veranda",
        scene.breakfastTable,
      ),
      shot(
        "Panelled walls, deep-set windows and a fireplace in a colonial sitting room.",
        "Panelled rooms, original proportions",
        scene.readingRoom,
      ),
    ],
    facts: [
      { icon: "group", label: "Capacity", value: "3 Guests" },
      { icon: "bed", label: "Bedding", value: "1 King Bed" },
      { icon: "bathtub", label: "Bath", value: "Attached Bath" },
      { icon: "location_on", label: "Built", value: "c. 1870s" },
    ],
    story: [
      "Tumsong was one of the original outlying estates of Darjeeling, and the Burra Sahib's bungalow was built around the 1870s for the manager who ran it. Chamong restored it rather than rebuilt it, keeping the panelling, the deep-set windows and the proportions that let the mountain fill the room from the bed. From the valley-side rooms the Kanchenjunga massif sits directly ahead of you; the Spring and Summer Valley Abodes at ₹8,000 are the ones to book if the view is the point of the trip.",
      "The guided tea garden walk leaves from the front steps and covers the working part of the estate, with a factory visit on the same route depending on the day. Rates are quoted per room on the included meal plan, with GST shown separately — the headline figure on this listing is the ₹4,500 entry price for the Mist and Autumn Valley Abodes.",
    ],
    reviews: [
      {
        name: "Vikram & Aditi Rao",
        initials: "VR",
        stayed: "October 2025 • Stayed 3 nights",
        quote:
          "Booked the Kanchenjunga-facing room and woke up to the whole massif in cloud-free light. The tea garden walk right after breakfast is the best hour of our trip.",
        tone: "sage",
      },
      {
        name: "Debashish Sen",
        initials: "DS",
        stayed: "January 2026 • Stayed 2 nights",
        quote:
          "Well restored colonial rooms at a fraction of what the big estates charge. The veranda breakfast with the valley in front of you is worth the room on its own.",
        tone: "clay",
      },
      {
        name: "Hannah Whitfield",
        initials: "HW",
        stayed: "November 2025 • Stayed 4 nights",
        quote:
          "The staff arranged a dawn trip to Tiger Hill and it made the whole stay. Impeccable service, and the rate for this view is remarkable.",
        tone: "sand",
      },
    ],
  },
  {
    slug: "takdah-heritage-bungalow",
    name: "Takdah Heritage Bungalow",
    wing: "Bungalow No. 12 · Takdah",
    kind: "heritage",
    kindLabel: "Heritage Bungalow",
    petFriendly: false,
    price: 3000,
    maxGuests: 4,
    occupancy: "1 Deluxe Room • Up to 4 Guests",
    bedIcon: "bed",
    blurb:
      "One of the surviving British-era bungalows at Takdah, 28 km from Darjeeling and a short walk from Rangli Rangliot Tea Garden. Standard ₹3,000, Deluxe ₹4,000, Super Deluxe ₹5,000 and Suite ₹7,000 per night.",
    amenities: ["Colonial Bungalow", "Rangli Rangliot Nearby", "Six Rooms Only"],
    highlight: { icon: "history_edu", label: "British-Era Building" },
    rating: 4.7,
    reviewCount: 203,
    eyebrow: "The Quiet Outpost",
    intro:
      "Takdah was an important British administrative station before Darjeeling took over, and the bungalows survive. Bungalow No. 12 has six rooms in its original shell, a short walk from Rangli Rangliot Tea Garden and far from the town traffic.",
    image: cover.takdah,
    imageAlt:
      "A colonial bungalow veranda in Takhangam with wooden shutters, a low veranda rail and forested slopes behind.",
    gallery: [
      {
        src: cover.takdah,
        alt: "The veranda of a Takdah heritage bungalow with wooden shutters and forest beyond.",
        caption: "Bungalow No. 12, Takdah",
      },
      shot(
        "Rangli Rangliot Tea Garden terraces dropping away below the bungalow roofline.",
        "Rangli Rangliot, minutes away",
        scene.teaGardenPatio,
      ),
      shot(
        "A simple homestyle dinner of rice, curry and greens set out on a veranda table.",
        "Home-cooked Nepali meals",
        scene.breakfastTable,
      ),
      shot(
        "A colonial bungalow bedroom with shuttered windows, a wooden floor and thick cotton bedding.",
        "Rooms in the original shell",
        scene.timberJoinery,
      ),
    ],
    facts: [
      { icon: "group", label: "Capacity", value: "4 Guests" },
      { icon: "bed", label: "Bedding", value: "1 Double Bed" },
      { icon: "bathtub", label: "Bath", value: "Attached Bath" },
      { icon: "location_on", label: "Rooms", value: "6 in Total" },
    ],
    story: [
      "Takdah was a substantial British hill station in its own right before Darjeeling overtook it, and a good number of the original bungalows are still standing. Number 12 is one that survived, and the renovation kept the wooden floors, the shuttered openings and the low ceilings that make these houses worth staying in. The range runs from a ₹3,000 Standard room through Deluxe at ₹4,000 and Super Deluxe at ₹5,000 to a ₹7,000 Suite — this listing is priced at the entry Standard.",
      "It is a quieter base than Darjeeling town, with Rangli Rangliot Tea Garden essentially next door and the Tiger Hill road close enough for an early start. Most guests use it as a stop on the way to Kalimpong or as a base for Singbulli and Darjeeling's outlying tea estates rather than as a base for the town itself.",
    ],
    reviews: [
      {
        name: "Nikhil & Sara Menon",
        initials: "NM",
        stayed: "December 2025 • Stayed 2 nights",
        quote:
          "We came for Rangli Rangliot and ended up staying two extra nights. The bungalow has real character, the food is excellent, and the price is a fraction of anything in town.",
        tone: "clay",
      },
      {
        name: "Priyanka Joshi",
        initials: "PJ",
        stayed: "February 2026 • Stayed 1 night",
        quote:
          "Clean, characterful and genuinely homely. The bungalow is a fifteen minute walk from the tea garden gate, which is how the morning should start.",
        tone: "sage",
      },
      {
        name: "Rajeev & Sudha Iyer",
        initials: "RS",
        stayed: "November 2025 • Stayed 3 nights",
        quote:
          "An honest, well-run heritage bungalow. Not a boutique hotel, but that is the appeal — someone actually lives here and cooks for you.",
        tone: "sand",
      },
    ],
  },
  {
    slug: "nembang-homestay",
    name: "Nembang Homestay",
    wing: "Dali · 300 m from Peace Pagoda",
    kind: "homestay",
    kindLabel: "Family Homestay",
    petFriendly: false,
    price: 3099,
    maxGuests: 3,
    occupancy: "1 Deluxe Room • Up to 3 Guests",
    bedIcon: "king_bed",
    blurb:
      "A family-run homestay in Dali, a few minutes' walk from the Japanese Peace Pagoda. The deluxe mountain-view room is ₹3,099 per night, and the view runs all the way to Kanchenjunga on a clear morning.",
    amenities: ["Mountain View Room", "Near Peace Pagoda", "Home-Cooked Meals"],
    highlight: { icon: "visibility", label: "Panoramic View Room" },
    rating: 4.8,
    reviewCount: 148,
    eyebrow: "Dali Homestay",
    intro:
      "Dali is the quiet town below Darjeeling where the Japanese built the Peace Pagoda in 1972, and it has become the hill homestay belt. Nembang's deluxe room looks straight down the valley — the best value view room on this list.",
    image: cover.nembang,
    imageAlt:
      "A bright homestay room in Dali with a large window over green hills, a wooden bed and a small desk.",
    gallery: [
      {
        src: cover.nembang,
        alt: "The deluxe mountain-view room at Nembang Homestay, with a wide window over the Dali valley.",
        caption: "The deluxe mountain-view room",
      },
      shot(
        "Layered green ridges falling away towards the plains below Dali on a clear morning.",
        "The view from the deluxe room",
        scene.teaGardenPatio,
      ),
      shot(
        "A Nepali breakfast of eggs, rice, curry and chai laid out on a homestay dining table.",
        "Home-cooked, every morning",
        scene.breakfastTable,
      ),
      shot(
        "A modest homestay room with cotton bedding, a window seat and warm wood trim.",
        "Simple rooms, warm hosts",
        scene.timberJoinery,
      ),
    ],
    facts: [
      { icon: "group", label: "Capacity", value: "3 Guests" },
      { icon: "bed", label: "Bedding", value: "1 Double Bed" },
      { icon: "bathtub", label: "Bath", value: "Attached Bath" },
      { icon: "location_on", label: "Town", value: "Dali, 7 km below" },
    ],
    story: [
      "Dali sits seven kilometres below Darjeeling at the road junction, and since the Japanese Peace Pagoda was built there in 1972 it has turned into the hill homestay belt — dozens of family houses taking guests, most of them an easy walk from the pagoda. Nembang is one of the better ones of that type, and the deluxe mountain-view room at ₹3,099 per night is the one to book: the window looks straight down the valley, and on a clear January morning the Kanchenjunga massif sits at the end of it.",
      "It is a homestay rather than a hotel, so what you are paying for is the family, the cooking and the view. Meals are home-cooked Nepali and arranged on request. Use it as a base for the Peace Pagoda, Ghoom Monastery, Tiger Hill and the Batasia Loop, all of which are within easy driving distance.",
    ],
    reviews: [
      {
        name: "Karthik & Divya Iyer",
        initials: "KD",
        stayed: "January 2026 • Stayed 3 nights",
        quote:
          "Woke up on the second morning to Kanchenjunga filling the window and did not move for an hour. At this price the view room is the obvious pick over the rest.",
        tone: "sage",
      },
      {
        name: "Tanvi Kulkarni",
        initials: "TK",
        stayed: "October 2025 • Stayed 2 nights",
        quote:
          "The family looked after us properly. Peace Pagoda and Ghoom Monastery are both easy from here, and we ate better than we have anywhere on the hill.",
        tone: "clay",
      },
      {
        name: "Omar & Lena Farouk",
        initials: "OF",
        stayed: "February 2026 • Stayed 4 nights",
        quote:
          "Used it as a base for Tiger Hill sunrise trips. The room is clean, the food is excellent and the hosts arranged every car we needed without fuss.",
        tone: "sand",
      },
    ],
  },
  {
    slug: "dorje-hill-stay",
    name: "Dorje Hill Stay",
    wing: "Dali · Kurseong Road",
    kind: "homestay",
    kindLabel: "Family Homestay",
    petFriendly: true,
    price: 1568,
    maxGuests: 4,
    occupancy: "1 Mountain View Room • Up to 4 Guests",
    bedIcon: "king_bed",
    blurb:
      "An eight-room hillside homestay in Dali with private baths, balconies, heating and a shared kitchen. Mountain View Room 1 is ₹1,568 per night, with 5% weekly and 10% monthly discounts. Pets are welcome on request.",
    amenities: ["Pet Friendly", "Private Balcony", "Weekly & Monthly Discounts"],
    highlight: { icon: "pets", label: "Dogs Welcome" },
    rating: 4.7,
    reviewCount: 76,
    eyebrow: "The Hillside Homestay",
    intro:
      "Eight comfortable rooms on a Dali hillside, run by Nawang Bhutia, with private bathrooms, balconies, heating, high-speed Wi-Fi and a shared kitchen. The cheapest genuine mountain-view room on this list, and the one that takes dogs.",
    image: cover.dorjeHill,
    imageAlt:
      "A cosy mountain-view room at a Dali homestay with a balcony, a wood-panelled wall and a wide bed.",
    gallery: [
      {
        src: cover.dorjeHill,
        alt: "Mountain View Room 1 at Dorje Hill Stay, with a balcony and a wood-panelled interior.",
        caption: "Mountain View Room 1",
      },
      shot(
        "A hillside view from a Dali balcony looking across green ridges to the plains below.",
        "The balcony view",
        scene.teaGardenPatio,
      ),
      shot(
        "A shared homestay kitchen with a dining table, kettle and simple cooking facilities.",
        "Shared kitchen for self-catering",
        scene.breakfastTable,
      ),
      shot(
        "A warm panelled room with wood trim, soft lighting and a writing desk by the window.",
        "Wood-panelled throughout",
        scene.timberJoinery,
      ),
    ],
    facts: [
      { icon: "group", label: "Capacity", value: "4 Guests" },
      { icon: "bed", label: "Bedding", value: "1 Queen Bed" },
      { icon: "shower", label: "Bath", value: "Private Shower" },
      { icon: "location_on", label: "Rooms", value: "8 in Total" },
    ],
    story: [
      "Dorje Hill Stay is a relaxed hillside house in Dali with eight rooms, private bathrooms and balconies on each, heating for the cold months, high-speed Wi-Fi, a shared kitchen guests are welcome to use, and a workspace for anyone who needs to finish something. Nawang Bhutia runs it, and offers early check-in from 09:00, extra mattresses, home-cooked dinner and breakfast, and station or airport transfers as paid add-ons — ₹3,200 either way from Bagdogra or New Jalpaiguri.",
      "The Mountain View Room is ₹1,568 per night, and the pricing rewards longer stays: 5% off weekly and 10% off monthly. Smoking is permitted in the designated patio area only, and pets are allowed on request, which is why it is the pet-friendly option on this list. Check-in is from 12:00 and check-out before 11:00.",
    ],
    reviews: [
      {
        name: "Rohan & Meera Kapoor",
        initials: "RK",
        stayed: "November 2025 • Stayed 8 nights, with our dog",
        quote:
          "Our labrador was made completely at home and there was no extra charge. The monthly discount made a long stay affordable. The balcony is where we ate every evening.",
        tone: "clay",
      },
      {
        name: "Andreas & Clara Vogt",
        initials: "AV",
        stayed: "March 2026 • Stayed 3 nights",
        quote:
          "A warm, well-run family homestay for very little money. The heating matters more than you think in March, and the shared kitchen was spotless.",
        tone: "sage",
      },
      {
        name: "Lakshmi Subramanian",
        initials: "LS",
        stayed: "January 2026 • Stayed 5 nights",
        quote:
          "Nawang arranged our pickup, our Tiger Hill sunrise trip and an extra mattress without any fuss. Great value base for the whole Dali and Ghoom area.",
        tone: "sand",
      },
    ],
  },
];

export const kindFilters = [
  { kind: "all", label: "All Stays" },
  { kind: "estate", label: "Tea Estate Stays" },
  { kind: "heritage", label: "Heritage Bungalows" },
  { kind: "homestay", label: "Family Homestays" },
] as const;

export const sceneImages = scene;

export function getStay(slug: string): Stay | undefined {
  return stays.find((stay) => stay.slug === slug);
}

export function getStaySlugs(): string[] {
  return stays.map((stay) => stay.slug);
}

export function countByKind(kind: StayKind): number {
  return stays.filter((stay) => stay.kind === kind).length;
}

export function countPetFriendly(): number {
  return stays.filter((stay) => stay.petFriendly).length;
}
