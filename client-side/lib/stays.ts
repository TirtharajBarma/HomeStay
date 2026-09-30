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

const estate = {
  hostsInOrchard:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuCCHi6UFkrFm-BsrJDUHIEY5SNJPVVygbs-JabWIWVjlaKTUgXWiEIYlunIjFg0rSmBPboOHlgMj39T2eSSOT7EkLlLlotMt3Ml0VQ-H4uuZd795YgqNT0JrfGFn32tvocCMFZUUzXCaf6p4B5A_FeaKCjp1OMaAKS2YVeTXHIE6G_VkP4bnO6AxL_hJYbG1_w1qeTMPYbUr2QSlis82P6eTTJuADaP8KF2XHb65SbJCZP0B6NdRjYU",
  hostsPortrait:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBMgV16m5Vg-n38ORIaQe_IidYACn8d2DwL2kunbcSOa08FLttNGrorX-WOWHQJ8yjZFT1pH_w84gdIaq_Swv4-Q7sRXVK6BAzMMa6_HcEmiPMagk3w-O76urOSLbSSQi_x1BOpfd72336jO6l4mzPFKU5CcSLcVgifz1Rsq0SY8I9ir79bk5KWjEmTbh5_IY9TwSD3dis_q1zeHlcM0R2IRoCZql-6zpUbLIgXCJgHqQ3rvsGYxjZg",
  orchardPatio:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuBPbo-ppKvLPABVngySmWovKSGVio5EvMRRDu2pb8tn062eOlVXEzm62w-zu1LI_NF4YqY8Yl_g7vOZ5plQHCoWQemlrDVhFlIwJxeIA_wZgvD6QoP0jNIzVaikRNCxiFIRmkXsCbHdIJRKcq7TkUmP3EGmQ2ox0ImPOrY_NkmPpdw7l7Jgg3iCdZajC-i0l_nGm-XY91PCau_I_G0uobbTfwhqPmcdnVFGC5W1UJnucZHUw9V2uAEP",
  farmsteadBreakfast:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDx5qrECwuU10zbmofVV1D-DPWAblVUwkdaYkFomHfZpsNcUnz-GNq4zwfiZEg_he2KyuPHovGLXvy06q32as1loRO3cRAzGrNlw9F6eregBAHiTy36fzcdXtG2Cv2wt_5D_wacdOmnJvKG6SimJLuNdTSzskHO1378TV5HzDINdqaWfKFyBgE3lt3ULXEIop3T7DlNIzgw4UyYD1HgsTW-DwJH9_8BMd7wCMlWaC32EXZkm6FJLs-5",
  cedarJoinery:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDkkNzhbvlU8E_aJ4oUrndjSjlB0Ga8NyCGWxUrHIpaiveRbb-zOTnyzaCjOTfGm1zqVUpeQn-BArJybguyCnnB3mdnMi9XOhnLgdZ0_OUDQPw300oamTh-6DxPJ58keDCirYFqUt4R45gDPkbgxF_fuI0cMqrjSvPT7mT9rv-vJAltWOfmm-qsoB_pKes8n5EINCXe1nHic5OrEjo9usIhLaimGVaH_3BlQmwyU790UPkiqBi_wGYI",
  solarium:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuC257E05UXqlGZPoOvZNwCtDYk5VtQesH8blN30eogwlB3g9ekrW4W42VazJyr7Lq8xUEfVG9RdTNILO8DyFvb7P4Vc6jW2MPPQXu7EYtixH-lnz5s9wD5p2DtI5uKC9yrFRn3i9QGYGDPP491RKxbmFsdN0wt0QjKFqC8OENDBeTiYIiIHzTX0KHqoFlT6HPVcP2_E1GB1prwA3P93qzzv9aWIv7ZM9_f0IPSdZo9ja0d2IlLYRW9E",
  clawfootTub:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAQqR86iPdNVpd6ywlguUiiHJ5fZ7wybil7znUG4U1GVxwkCbQuaFEcqy7cqtqwWGPD-f4gWZyh8GqdXdvTVyotOeg60QqEnwWHnNapBVcUTAWySqnMH4bChOnXHbzkWPIyh0BdkT8OsyeVaqioVmKL234EsGo5CDf7Ug22gEW1TglIlNUeqt2yS3HVIfrjqJVNvw0O7NkQxAOUN-PlzLhIsGEMteKOj6xswYZWms39YwGcyiAz_QNm",
  oakHearthAlt:
    "The Oak Hearth Suite: king bed with oatmeal linen, exposed stone fireplace and lace curtains in morning light.",
};

const card = {
  oakHearth:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDhevMSJ8jcLv6V72NY3iIZ51nkiD7w9G6-wl0akdHXPKnsjgiyQeKyvzNMz9DdhaqzMrtuQOUN7mAaXsxcrMMhrgn0wPrOzmeEZm_2xJDhGp6PU3VtbnLwL5267C9IGr7xH9-X69z17q5sW_oGxG6-PSUco5LG4vCqeZNbujLc4O0AtdgR5S9b4i5sA0yH1oiCMsIle5HBm8fZtEC704hHjmy2xQV1Vszg6-0jdTnIoV5ggRkBes2o",
  timberLoft:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAzMTDC3NwT48_J_LOVuHXiwGKrJKmOrUu_aaxRgQ8Ipl-hkJZOnFUQHlX6BlW4wqfsb3me0y16oEkWh7ACTU6AQxj6q3TLB_-Db3vmMAU130aLKcb1v3NMWeOrHKPoMikR0-k0cbIX0wS3X1P3XGuvN3dzcxohQAlGIyNY_I2T7X3BbyscNihYTS25W6SjcRDwPdtUq1WyP7ODI_X9qB6UkU_dL8o8evjn498C_0op4mKDkVk3ubZl",
  gardenStone:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAR5QBCt_FngLzPy_7tfAtCAlJ554XzvlMYT7kp5kWSuS3ME_2vUfZSp568KqvPDWrFWLK_vg1SlROOW-4Q_D8NFqVqOAAcpyar7jVaoQJ5u02A_7ptSj7YlTO3unLjVF0hV82w-KomqvQNkiDvW6LLbtAgEyNF-tDdedyoN8rQdKJdD9eVRob1dHQvqId34dTJFmQwNPvTN0gxwHkKKXE9td1vqUmSkVhGWWSmdmnvlu66dq_Noypt",
  pineMeadow:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDxTjO6qBFZSPJyNG0A48aa1z4xyt5NRwWzM24IAeC9WkPZzaCk_ZxB0Bs3Ojp286sLcrhQTQSAtg5rVGf7Kv2VlGvLgmGk0ZrVAyE8qxZXJKa-KDdNF4jP7umPXz8bPwWtdSaSeuEunHx6vUQ6tA27NFcdh-KedhbrAgByaM3sUNUbgkgc_RNneHcADcKUW1d3evtjqeRa2OoOh55Jg4mHgGyGDZcXScOAI7rQ0XZOeHoEzOAw3ce_",
  atticStudio:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDdgQpd8CsHDJFkCLfk4GPjApsAqTwVWmLTHio3LS4_tW_EN6ajwrZa6DJZ4HBt1nIAhQUXRGItdWwEsrI3mir_oIhXr4OtCRT1AHyp5i0q1foXWUoyW5GEGacNZEQXtzlnUd6Vsg1bvs0rAeWJGmARwu7Xgq6Ph8U8AtuGBpWPk15yJCjKDOf_IA2lw27OnjIRv989jUzHpddmQYSKjLxFW9uTdY0tbjj_5UBnvy2Yxxxf2IZVh5cO",
  willowBrook:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAT7LzyrzlHpK-wp49RC0BDKDv40JNloG4pFEo6oRZf7G26_Hm5EEyT2R61bf95CsUi_IWb2IPOUwUMpv27vkuChFA6x8XSLIlrsNl_YWxQMhru0C9mXHo9wluNiLefnORpsLLBFCknexsaYV_bek-M8-e00WrG5SwsiW6P5GgtFsbjU7VJwc-3FT2qg6XbPU6NgXa6jrpXuFrry5nwsG5b-w68cgHqSslqGLvP_CAT6XPhKbt9gfQe",
};

const oakHero =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDcfzIQmrIltYDJhAxlcR86qZT7j2IaI_7SuxyZASGs4Y8yruKVNhyn0y7yjgpfAUr7Jmj4pk3rFp0GGi_DAAffa1YpycHnPBYPe5vVgBvgX-XrjneGe_N4GI38JRyfEL2WO_dWxjnlhIYFmpwP5BngP1_BwnCrX403yefAwuWf-_Iyup-CrRrMQpXCbkOqhHSAvD3XeEWYEPn2-UX9ouKqKVYI41re1dohSRLfNKL7zUSDHSgNnUcv";

const estateShot = (alt: string, caption: string, src: string): GalleryShot => ({
  src,
  alt,
  caption,
});

export const stays: Stay[] = [
  {
    slug: "oak-hearth-suite",
    name: "The Oak Hearth Suite",
    wing: "Cottage Main Wing",
    kind: "cottage",
    kindLabel: "Ground Floor Cottage",
    petFriendly: false,
    price: 195,
    maxGuests: 2,
    occupancy: "1 King Bed • 2 Guests",
    bedIcon: "king_bed",
    blurb:
      "Main Lodge ground-floor shelter with handcrafted oak timber joints, a deep crackling stone hearth, and quiet sunrise views.",
    amenities: ["Stone Fireplace", "Clawfoot Soaking Tub", "Private Verandah"],
    highlight: { icon: "coffee", label: "Breakfast included" },
    rating: 4.98,
    reviewCount: 48,
    eyebrow: "Estate Sanctuary Suite",
    intro:
      "A restful ground-floor sanctuary with handcrafted stone hearth, antique clawfoot tub, and morning light over the apple orchard.",
    image: card.oakHearth,
    imageAlt: estate.oakHearthAlt,
    gallery: [
      {
        src: oakHero,
        alt: "River stone fireplace glowing beside a king bed dressed in oatmeal linen.",
        caption: "Warm river stone hearth & king linen bed",
      },
      estateShot(
        "Antique clawfoot tub beside a bright casement window.",
        "Clawfoot Soaking Tub",
        estate.clawfootTub,
      ),
      estateShot(
        "Sunlit flagstone patio with teak armchairs under old apple trees.",
        "Orchard Stone Patio",
        estate.orchardPatio,
      ),
      estateShot(
        "A wicker basket of sourdough, preserve and cloth-wrapped eggs on a farmhouse table.",
        "Farmstead Breakfast",
        estate.farmsteadBreakfast,
      ),
      estateShot(
        "Rough-hewn cedar ceiling beams with mortise and tenon joinery.",
        "Handcrafted Cedar Joinery",
        estate.cedarJoinery,
      ),
    ],
    facts: [
      { icon: "group", label: "Capacity", value: "2 Guests" },
      { icon: "bed", label: "Bedding", value: "1 King Bed" },
      { icon: "bathtub", label: "Bath", value: "Clawfoot Tub" },
      { icon: "door_front", label: "Access", value: "Private Entrance" },
    ],
    story: [
      "Tucked into the historic southern wing of Meadowfall's 1892 lodge, The Oak Hearth Suite was envisioned as an unhurried restorative haven for readers, nature lovers, and travelers seeking tactile connection. Rebuilt with weathered river stone gathered directly from our whispering estate creek, the monumental fieldstone hearth sits at the spiritual center of the suite.",
      "Mornings unfold in absolute stillness, broken only by the chirping of bluebirds in the old apple orchard outside your casement windows. In the late afternoons, light cascades through hand-blown glass onto the reclaimed oak floorboards, warming your private reading nook. At dusk, Eleanor kindles the evening hearth with fragrant kiln-dried birchwood, providing a crackling ambiance suited for a glass of cellar cider.",
    ],
    reviews: [
      {
        name: "Clara & Julian Lin",
        initials: "CL",
        stayed: "September 2024 • Stayed 4 nights",
        quote:
          "Falling asleep to the gentle flicker of the river stone hearth after a soak in the clawfoot tub was the most grounding experience of our year. Eleanor's warm welcome and sourdough basket made us feel like returning family.",
        tone: "clay",
      },
      {
        name: "Dr. Marcus Vance",
        initials: "MK",
        stayed: "August 2024 • Solo Writing Retreat",
        quote:
          "The absolute silence of West Meadows Valley is extraordinary. I finished the final two chapters of my manuscript seated on the sunny stone patio with birds overhead. The linen sheets and heated bathroom floor were exquisite touches.",
        tone: "sage",
      },
      {
        name: "Sophia & Brenda Meyer",
        initials: "SB",
        stayed: "July 2024 • Stayed 2 nights",
        quote:
          "Thomas took time to guide us around the heritage apple orchard and taught us about cider pressing. Their hospitality embodies genuine countryside luxury. We will be back for autumn foliage.",
        tone: "sand",
      },
    ],
  },
  {
    slug: "timber-loft-barn",
    name: "The Timber Loft Barn",
    wing: "West Meadows Barn",
    kind: "loft",
    kindLabel: "Barn Loft",
    petFriendly: false,
    price: 240,
    maxGuests: 4,
    occupancy: "2 Beds • Up to 4 Guests",
    bedIcon: "bed",
    blurb:
      "Restored 19th-century post-and-beam loft with sweeping valley horizon vistas, artisan kitchenette, and copper double tub.",
    amenities: ["Panoramic Valley View", "Boutique Kitchenette", "Double Soaking Tub"],
    highlight: { icon: "mountain_flag", label: "Highest Viewpoint" },
    rating: 4.96,
    reviewCount: 37,
    eyebrow: "Sweeping Horizon Loft",
    intro:
      "The highest sleeping loft on the estate, with post-and-beam ceilings, a copper soaking tub for two, and the whole valley laid out beneath the arched window.",
    image: card.timberLoft,
    imageAlt:
      "Timber-framed barn loft with vaulted beams, an arched window over green hills, linen sofa and woven wool rugs.",
    gallery: [
      {
        src: card.timberLoft,
        alt: "Vaulted timber loft with an arched window looking out over the valley.",
        caption: "Vaulted beams & the full valley horizon",
      },
      estateShot(
        "Sunlit flagstone patio with teak armchairs under old apple trees.",
        "Orchard Stone Patio",
        estate.orchardPatio,
      ),
      estateShot(
        "A wicker basket of sourdough, preserve and cloth-wrapped eggs on a farmhouse table.",
        "Farmstead Breakfast",
        estate.farmsteadBreakfast,
      ),
      estateShot(
        "Panoramic lounge with timber ceiling and warm light across the floorboards.",
        "Estate Solarium & Library",
        estate.solarium,
      ),
    ],
    facts: [
      { icon: "group", label: "Capacity", value: "4 Guests" },
      { icon: "bed", label: "Bedding", value: "2 Beds" },
      { icon: "bathtub", label: "Bath", value: "Copper Double Tub" },
      { icon: "stairs", label: "Access", value: "Barn Staircase" },
    ],
    story: [
      "The original hayloft of the 1892 dairy barn, stripped back to its hand-hewn posts and beams and rebuilt around a single arched window that frames the whole of West Meadows Valley. The kitchenette stocks a copper kettle, local honey and everything needed for a slow breakfast without leaving the building.",
      "Wake to mist lifting off the meadow, then walk out onto the private gantry and watch the ridge light up. Evenings are for the wood stove, a record on the turntable, and the particular silence of being the highest room on the estate.",
    ],
    reviews: [
      {
        name: "Dr. Julian Rivera",
        initials: "JR",
        stayed: "August 2024 • Stayed 5 nights",
        quote:
          "The Timber Loft Barn is one of the most stunning spaces we have ever rested in. Watching the valley mist rise over morning pour-over coffee was completely unforgettable.",
        tone: "sage",
      },
      {
        name: "The Nkemelu Family",
        initials: "TN",
        stayed: "September 2024 • Stayed 3 nights",
        quote:
          "Two adults, two children, and not one moment of friction. The loft gave us all our own corners, and the kitchenette meant we could make lunch while the kids explored the orchard.",
        tone: "clay",
      },
    ],
  },
  {
    slug: "garden-stone-suite",
    name: "Garden Stone Suite",
    wing: "Cottage Wing",
    kind: "cottage",
    kindLabel: "Ground Floor Cottage",
    petFriendly: true,
    price: 175,
    maxGuests: 3,
    occupancy: "1 Queen + Daybed • 3 Guests",
    bedIcon: "bed",
    blurb:
      "Ground-level stone retreat opening directly onto the heirloom herb garden. Perfect for travelers exploring with companion dogs.",
    amenities: ["Pet Friendly", "Direct Garden Access", "Private Terrace"],
    highlight: { icon: "yard", label: "Orchard Steps Away" },
    rating: 4.94,
    reviewCount: 29,
    eyebrow: "Garden Level Suite",
    intro:
      "A flagstone suite with french doors that open straight into the heirloom herb garden — our most loved room for guests travelling with dogs.",
    image: card.gardenStone,
    imageAlt:
      "Ground-floor cottage with flagstone floors, french doors open to a blooming herb garden and a queen bed with a woven throw.",
    gallery: [
      {
        src: card.gardenStone,
        alt: "Cottage suite with french doors opening onto a blooming herb garden.",
        caption: "French doors straight into the herb garden",
      },
      estateShot(
        "Sunlit flagstone patio with terracotta pots of rosemary and thyme.",
        "Orchard Stone Patio",
        estate.orchardPatio,
      ),
      estateShot(
        "Eleanor and Thomas standing in the cider orchard with a basket of apples.",
        "Meet your hosts",
        estate.hostsInOrchard,
      ),
      estateShot(
        "A wicker basket of sourdough, preserve and cloth-wrapped eggs on a farmhouse table.",
        "Farmstead Breakfast",
        estate.farmsteadBreakfast,
      ),
    ],
    facts: [
      { icon: "group", label: "Capacity", value: "3 Guests" },
      { icon: "bed", label: "Bedding", value: "Queen + Daybed" },
      { icon: "bathtub", label: "Bath", value: "Garden Bath" },
      { icon: "door_front", label: "Access", value: "Garden Level Entrance" },
    ],
    story: [
      "Built along the original garden wall, this suite keeps the ground floor of the cottage wing and opens through french doors onto beds of rosemary, thyme and chamomile that Thomas tends with a scythe and considerable patience. Dogs are genuinely welcome here — there is a wash station by the terrace and a towel waiting.",
      "It is the easiest room in the estate to settle into for a long week: morning light on the flagstones, the meadow trail starting twenty feet from the door, and dinner from the garden a short walk back through the orchard.",
    ],
    reviews: [
      {
        name: "Sarah & Marcus M.",
        initials: "SM",
        stayed: "October 2024 • Stayed 4 nights",
        quote:
          "Our golden retriever felt right at home in the Garden Stone Suite. Having the meadow trails starting 20 feet from the door made this our best Vermont trip ever.",
        tone: "sand",
      },
      {
        name: "Ingrid Halvorsen",
        initials: "IH",
        stayed: "September 2024 • Stayed 2 nights",
        quote:
          "I harvested rosemary and thyme straight outside my door while the kettle boiled. It is the sweetest room on the estate for a travelling cook.",
        tone: "clay",
      },
    ],
  },
  {
    slug: "pine-meadow-cabin",
    name: "Pine Meadow Cabin",
    wing: "Secluded Orchard",
    kind: "cabin",
    kindLabel: "Secluded Cabin",
    petFriendly: false,
    price: 280,
    maxGuests: 2,
    occupancy: "1 King Bed • 2 Guests",
    bedIcon: "king_bed",
    blurb:
      "Totally autonomous cedar timber cabin secluded within heirloom apple rows. Featuring a wood-fired cedar tub and stargazing firepit.",
    amenities: ["Outdoor Cedar Tub", "Wraparound Porch", "Firepit"],
    highlight: { icon: "spa", label: "Private Wellness" },
    rating: 4.99,
    reviewCount: 21,
    eyebrow: "Autonomous Cedar Cabin",
    intro:
      "A standalone cedar cabin set deep in the heirloom apple rows, with a wood-fired soaking tub on the deck and a firepit for the clearest skies in the valley.",
    image: card.pineMeadow,
    imageAlt:
      "Standalone cedar cabin at the edge of a pine wood, with a steaming outdoor tub on the deck and a firepit in the dusk.",
    gallery: [
      {
        src: card.pineMeadow,
        alt: "Cedar cabin with an outdoor soaking tub and a firepit in the clearing.",
        caption: "Wood-fired cedar tub under the pines",
      },
      estateShot(
        "Rough-hewn cedar ceiling beams with mortise and tenon joinery.",
        "Handcrafted Cedar Joinery",
        estate.cedarJoinery,
      ),
      estateShot(
        "Sunlit flagstone patio with teak armchairs under old apple trees.",
        "Orchard Stone Patio",
        estate.orchardPatio,
      ),
      estateShot(
        "Eleanor and Thomas on the timber farmhouse porch.",
        "Meet your hosts",
        estate.hostsPortrait,
      ),
    ],
    facts: [
      { icon: "group", label: "Capacity", value: "2 Guests" },
      { icon: "bed", label: "Bedding", value: "1 King Bed" },
      { icon: "bathtub", label: "Bath", value: "Outdoor Cedar Tub" },
      { icon: "deck", label: "Access", value: "Wraparound Porch" },
    ],
    story: [
      "Twenty minutes' walk from the lodge and a world apart: a cedar cabin the pair built from timber milled two valleys away, standing alone in the old apple rows with nothing but orchard and pine between it and the ridge.",
      "The tub is filled and fired for you on request, the firepit is laid with dry birch, and the walk back to the lodge is optional. This is the room to book when the point of the trip is to be entirely undisturbed.",
    ],
    reviews: [
      {
        name: "Amelia & Tom Barrett",
        initials: "AB",
        stayed: "October 2024 • Stayed 3 nights",
        quote:
          "We stayed in the tub until the steam came off the mirror and then sat by the firepit counting satellites. You would not believe how little we wanted to leave.",
        tone: "clay",
      },
      {
        name: "Noor Haddad",
        initials: "NH",
        stayed: "July 2024 • Stayed 2 nights",
        quote:
          "The most private room I have ever booked, and the firewood was already stacked by the door. Book the cedar tub and stay in for the weather.",
        tone: "sage",
      },
    ],
  },
  {
    slug: "orchard-attic-studio",
    name: "Orchard Attic Studio",
    wing: "Main Lodge Upper Level",
    kind: "loft",
    kindLabel: "Barn Loft",
    petFriendly: false,
    price: 160,
    maxGuests: 2,
    occupancy: "Queen Bed • 2 Guests",
    bedIcon: "bed",
    blurb:
      "An intimate hideaway tucked beneath the lodge eaves. Fall asleep under clear starry constellations with an espresso bar and vinyl collection.",
    amenities: ["Stargazing Skylight", "Espresso Nook", "Record Player"],
    highlight: { icon: "nightlight", label: "Stargazing Eaves" },
    rating: 4.92,
    reviewCount: 44,
    eyebrow: "Eaves Studio",
    intro:
      "A compact studio under the lodge eaves with a glass skylight over the bed, an espresso bar, and the estate's vinyl collection to play your way through.",
    image: card.atticStudio,
    imageAlt:
      "Attic studio with sloping whitewashed ceilings, a skylight over a queen bed, books and a record player.",
    gallery: [
      {
        src: card.atticStudio,
        alt: "Attic studio with a glass skylight and a record player beside the bed.",
        caption: "Skylight directly above the bed",
      },
      estateShot(
        "Rough-hewn cedar ceiling beams with hand-plastered lime wash walls.",
        "Whitewashed Eaves & Beams",
        estate.cedarJoinery,
      ),
      estateShot(
        "Panoramic lounge with timber ceiling and warm light across the floorboards.",
        "Estate Solarium & Library",
        estate.solarium,
      ),
      estateShot(
        "Eleanor and Thomas standing in the cider orchard.",
        "Meet your hosts",
        estate.hostsInOrchard,
      ),
    ],
    facts: [
      { icon: "group", label: "Capacity", value: "2 Guests" },
      { icon: "bed", label: "Bedding", value: "Queen Bed" },
      { icon: "bathtub", label: "Bath", value: "Ensuite Shower" },
      { icon: "stairs", label: "Access", value: "Lodge Staircase" },
    ],
    story: [
      "The smallest and cosiest of the six spaces: a whitewashed studio tucked into the eaves, where the skylight sits directly over the bed and the roof slopes low enough to make the whole room feel like a hug.",
      "There is an espresso bar with a hand grinder, a shelf of paperbacks, and the estate record player. It is the room most often booked for a single night on the way to somewhere else — and the one guests rebook for a week.",
    ],
    reviews: [
      {
        name: "Jonas Lindqvist",
        initials: "JL",
        stayed: "October 2024 • Stayed 1 night",
        quote:
          "An hour of sleep lost to the skylight and worth every minute. Woke to frost on the glass and coffee already ground.",
        tone: "sand",
      },
      {
        name: "Priyanka & Dev Rao",
        initials: "PD",
        stayed: "September 2024 • Stayed 3 nights",
        quote:
          "Small in the best way — everything a writer needs and nothing else. The record player got a great deal of use.",
        tone: "sage",
      },
    ],
  },
  {
    slug: "willow-brook-hideaway",
    name: "Willow Brook Hideaway",
    wing: "Creek Pathway",
    kind: "cabin",
    kindLabel: "Secluded Cabin",
    petFriendly: false,
    price: 210,
    maxGuests: 2,
    occupancy: "King Bed • 2 Guests",
    bedIcon: "king_bed",
    blurb:
      "Positioned along the murmuring Meadowfall stream. Features a cast iron wood stove, cantilevered creek balcony, and pure tranquil solitude.",
    amenities: ["Wood Stove", "Creek Balcony", "Restful Solitude"],
    highlight: { icon: "water", label: "Waterside Balcony" },
    rating: 4.97,
    reviewCount: 26,
    eyebrow: "Creek Side Cabin",
    intro:
      "A cedar-panelled cabin set over the brook itself, with a cast iron stove, a cantilevered balcony above the water, and weeping willows at the door.",
    image: card.willowBrook,
    imageAlt:
      "Cedar-panelled cabin with a cast iron wood stove and a balcony over a brook lined with weeping willows.",
    gallery: [
      {
        src: card.willowBrook,
        alt: "Cabin interior with a cast iron wood stove and a balcony over the brook.",
        caption: "Cast iron stove & cantilevered creek balcony",
      },
      estateShot(
        "A wicker basket of sourdough, preserve and cloth-wrapped eggs on a farmhouse table.",
        "Farmstead Breakfast",
        estate.farmsteadBreakfast,
      ),
      estateShot(
        "Sunlit flagstone patio with teak armchairs under old apple trees.",
        "Orchard Stone Patio",
        estate.orchardPatio,
      ),
      estateShot(
        "Eleanor and Thomas on the timber farmhouse porch.",
        "Meet your hosts",
        estate.hostsPortrait,
      ),
    ],
    facts: [
      { icon: "group", label: "Capacity", value: "2 Guests" },
      { icon: "bed", label: "Bedding", value: "1 King Bed" },
      { icon: "bathtub", label: "Bath", value: "Tub & Stove" },
      { icon: "water", label: "Access", value: "Creek Pathway" },
    ],
    story: [
      "Sitting on the bank of the brook that gives the estate its name, this cabin is cedar-lined inside and out, with a cast iron stove that Eleanor lights before you arrive. The balcony hangs out over the water — close enough to hear the current, high enough that the willows brush the rail.",
      "It is the quietest of the six. The creek trail passes the door and the sunset firepit is a two-minute walk, if the mood takes you out.",
    ],
    reviews: [
      {
        name: "Hannah Osei",
        initials: "HO",
        stayed: "October 2024 • Stayed 4 nights",
        quote:
          "I came to finish a book and finished nothing at all. The brook does most of the work; the stove does the rest.",
        tone: "clay",
      },
      {
        name: "Kestrel & Wren Duo",
        initials: "KW",
        stayed: "August 2024 • Stayed 2 nights",
        quote:
          "The balcony over the water is the best reading spot in Vermont. We were asleep by nine and awake by six, utterly content.",
        tone: "sage",
      },
    ],
  },
];

export const kindFilters = [
  { kind: "all", label: "All Stays" },
  { kind: "cottage", label: "Ground Floor Cottages" },
  { kind: "loft", label: "Barn Lofts" },
  { kind: "cabin", label: "Secluded Cabins" },
] as const;

export const estateImages = estate;

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
