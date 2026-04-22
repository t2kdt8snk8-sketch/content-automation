/**
 * Minecraft Block Database — 100+ blocks with average RGB colors
 * Used for color matching and block palette display
 */

const BLOCKS = [
    // ═══════════════════════════ STONE ═══════════════════════════
    { id: 'stone', name: 'Stone', nameKo: '돌', category: 'stone', rgb: [125, 125, 125], hex: '#7D7D7D' },
    { id: 'cobblestone', name: 'Cobblestone', nameKo: '조약돌', category: 'stone', rgb: [127, 127, 127], hex: '#7F7F7F' },
    { id: 'stone_bricks', name: 'Stone Bricks', nameKo: '석재 벽돌', category: 'stone', rgb: [122, 122, 122], hex: '#7A7A7A' },
    { id: 'mossy_stone_bricks', name: 'Mossy Stone Bricks', nameKo: '이끼 낀 석재 벽돌', category: 'stone', rgb: [115, 121, 105], hex: '#73796A' },
    { id: 'cracked_stone_bricks', name: 'Cracked Stone Bricks', nameKo: '금 간 석재 벽돌', category: 'stone', rgb: [118, 117, 118], hex: '#767576' },
    { id: 'smooth_stone', name: 'Smooth Stone', nameKo: '매끈한 돌', category: 'stone', rgb: [158, 158, 158], hex: '#9E9E9E' },
    { id: 'andesite', name: 'Andesite', nameKo: '안산암', category: 'stone', rgb: [136, 136, 136], hex: '#888888' },
    { id: 'polished_andesite', name: 'Polished Andesite', nameKo: '윤나는 안산암', category: 'stone', rgb: [132, 135, 133], hex: '#848784' },
    { id: 'diorite', name: 'Diorite', nameKo: '섬록암', category: 'stone', rgb: [188, 188, 188], hex: '#BCBCBC' },
    { id: 'polished_diorite', name: 'Polished Diorite', nameKo: '윤나는 섬록암', category: 'stone', rgb: [192, 193, 194], hex: '#C0C1C2' },
    { id: 'granite', name: 'Granite', nameKo: '화강암', category: 'stone', rgb: [149, 103, 85], hex: '#956753' },
    { id: 'polished_granite', name: 'Polished Granite', nameKo: '윤나는 화강암', category: 'stone', rgb: [154, 106, 89], hex: '#9A6A59' },
    { id: 'deepslate', name: 'Deepslate', nameKo: '심층암', category: 'stone', rgb: [80, 80, 82], hex: '#505052' },
    { id: 'deepslate_bricks', name: 'Deepslate Bricks', nameKo: '심층암 벽돌', category: 'stone', rgb: [70, 70, 74], hex: '#46464A' },
    { id: 'deepslate_tiles', name: 'Deepslate Tiles', nameKo: '심층암 타일', category: 'stone', rgb: [54, 54, 57], hex: '#363639' },
    { id: 'tuff', name: 'Tuff', nameKo: '응회암', category: 'stone', rgb: [108, 109, 102], hex: '#6C6D66' },

    // ═══════════════════════════ WOOD ═══════════════════════════
    { id: 'oak_planks', name: 'Oak Planks', nameKo: '참나무 판자', category: 'wood', rgb: [162, 130, 78], hex: '#A2824E' },
    { id: 'oak_log', name: 'Oak Log', nameKo: '참나무 원목', category: 'wood', rgb: [109, 85, 50], hex: '#6D5532' },
    { id: 'spruce_planks', name: 'Spruce Planks', nameKo: '가문비나무 판자', category: 'wood', rgb: [114, 84, 48], hex: '#725430' },
    { id: 'spruce_log', name: 'Spruce Log', nameKo: '가문비나무 원목', category: 'wood', rgb: [58, 37, 16], hex: '#3A2510' },
    { id: 'birch_planks', name: 'Birch Planks', nameKo: '자작나무 판자', category: 'wood', rgb: [196, 179, 123], hex: '#C4B37B' },
    { id: 'birch_log', name: 'Birch Log', nameKo: '자작나무 원목', category: 'wood', rgb: [216, 215, 210], hex: '#D8D7D2' },
    { id: 'jungle_planks', name: 'Jungle Planks', nameKo: '정글나무 판자', category: 'wood', rgb: [160, 115, 80], hex: '#A07350' },
    { id: 'acacia_planks', name: 'Acacia Planks', nameKo: '아카시아 판자', category: 'wood', rgb: [168, 90, 50], hex: '#A85A32' },
    { id: 'dark_oak_planks', name: 'Dark Oak Planks', nameKo: '짙은 참나무 판자', category: 'wood', rgb: [66, 43, 20], hex: '#422B14' },
    { id: 'dark_oak_log', name: 'Dark Oak Log', nameKo: '짙은 참나무 원목', category: 'wood', rgb: [60, 46, 26], hex: '#3C2E1A' },
    { id: 'mangrove_planks', name: 'Mangrove Planks', nameKo: '맹그로브 판자', category: 'wood', rgb: [117, 54, 48], hex: '#753630' },
    { id: 'cherry_planks', name: 'Cherry Planks', nameKo: '벚나무 판자', category: 'wood', rgb: [226, 178, 172], hex: '#E2B2AC' },
    { id: 'bamboo_planks', name: 'Bamboo Planks', nameKo: '대나무 판자', category: 'wood', rgb: [194, 175, 82], hex: '#C2AF52' },
    { id: 'crimson_planks', name: 'Crimson Planks', nameKo: '진홍빛 판자', category: 'wood', rgb: [101, 48, 70], hex: '#653046' },
    { id: 'warped_planks', name: 'Warped Planks', nameKo: '뒤틀린 판자', category: 'wood', rgb: [43, 104, 99], hex: '#2B6863' },

    // ═══════════════════════════ CONCRETE ═══════════════════════════
    { id: 'white_concrete', name: 'White Concrete', nameKo: '하얀색 콘크리트', category: 'concrete', rgb: [207, 213, 214], hex: '#CFD5D6' },
    { id: 'orange_concrete', name: 'Orange Concrete', nameKo: '주황색 콘크리트', category: 'concrete', rgb: [224, 97, 1], hex: '#E06101' },
    { id: 'magenta_concrete', name: 'Magenta Concrete', nameKo: '자홍색 콘크리트', category: 'concrete', rgb: [169, 48, 159], hex: '#A9309F' },
    { id: 'light_blue_concrete', name: 'Light Blue Concrete', nameKo: '하늘색 콘크리트', category: 'concrete', rgb: [35, 137, 198], hex: '#2389C6' },
    { id: 'yellow_concrete', name: 'Yellow Concrete', nameKo: '노란색 콘크리트', category: 'concrete', rgb: [240, 175, 21], hex: '#F0AF15' },
    { id: 'lime_concrete', name: 'Lime Concrete', nameKo: '연두색 콘크리트', category: 'concrete', rgb: [94, 169, 24], hex: '#5EA918' },
    { id: 'pink_concrete', name: 'Pink Concrete', nameKo: '분홍색 콘크리트', category: 'concrete', rgb: [213, 101, 143], hex: '#D5658F' },
    { id: 'gray_concrete', name: 'Gray Concrete', nameKo: '회색 콘크리트', category: 'concrete', rgb: [54, 57, 61], hex: '#36393D' },
    { id: 'light_gray_concrete', name: 'Light Gray Concrete', nameKo: '밝은 회색 콘크리트', category: 'concrete', rgb: [125, 125, 115], hex: '#7D7D73' },
    { id: 'cyan_concrete', name: 'Cyan Concrete', nameKo: '청록색 콘크리트', category: 'concrete', rgb: [21, 119, 136], hex: '#157788' },
    { id: 'purple_concrete', name: 'Purple Concrete', nameKo: '보라색 콘크리트', category: 'concrete', rgb: [100, 31, 156], hex: '#641F9C' },
    { id: 'blue_concrete', name: 'Blue Concrete', nameKo: '파란색 콘크리트', category: 'concrete', rgb: [44, 46, 143], hex: '#2C2E8F' },
    { id: 'brown_concrete', name: 'Brown Concrete', nameKo: '갈색 콘크리트', category: 'concrete', rgb: [96, 59, 31], hex: '#603B1F' },
    { id: 'green_concrete', name: 'Green Concrete', nameKo: '초록색 콘크리트', category: 'concrete', rgb: [73, 91, 36], hex: '#495B24' },
    { id: 'red_concrete', name: 'Red Concrete', nameKo: '빨간색 콘크리트', category: 'concrete', rgb: [142, 32, 32], hex: '#8E2020' },
    { id: 'black_concrete', name: 'Black Concrete', nameKo: '검은색 콘크리트', category: 'concrete', rgb: [8, 10, 15], hex: '#080A0F' },

    // ═══════════════════════════ TERRACOTTA ═══════════════════════════
    { id: 'terracotta', name: 'Terracotta', nameKo: '테라코타', category: 'terracotta', rgb: [152, 94, 67], hex: '#985E43' },
    { id: 'white_terracotta', name: 'White Terracotta', nameKo: '하얀색 테라코타', category: 'terracotta', rgb: [209, 178, 161], hex: '#D1B2A1' },
    { id: 'orange_terracotta', name: 'Orange Terracotta', nameKo: '주황색 테라코타', category: 'terracotta', rgb: [161, 83, 37], hex: '#A15325' },
    { id: 'magenta_terracotta', name: 'Magenta Terracotta', nameKo: '자홍색 테라코타', category: 'terracotta', rgb: [149, 88, 108], hex: '#95586C' },
    { id: 'light_blue_terracotta', name: 'Light Blue Terracotta', nameKo: '하늘색 테라코타', category: 'terracotta', rgb: [113, 108, 137], hex: '#716C89' },
    { id: 'yellow_terracotta', name: 'Yellow Terracotta', nameKo: '노란색 테라코타', category: 'terracotta', rgb: [186, 133, 35], hex: '#BA8523' },
    { id: 'lime_terracotta', name: 'Lime Terracotta', nameKo: '연두색 테라코타', category: 'terracotta', rgb: [103, 117, 52], hex: '#677534' },
    { id: 'pink_terracotta', name: 'Pink Terracotta', nameKo: '분홍색 테라코타', category: 'terracotta', rgb: [161, 78, 78], hex: '#A14E4E' },
    { id: 'gray_terracotta', name: 'Gray Terracotta', nameKo: '회색 테라코타', category: 'terracotta', rgb: [57, 42, 35], hex: '#392A23' },
    { id: 'light_gray_terracotta', name: 'Light Gray Terracotta', nameKo: '밝은 회색 테라코타', category: 'terracotta', rgb: [135, 106, 97], hex: '#876A61' },
    { id: 'cyan_terracotta', name: 'Cyan Terracotta', nameKo: '청록색 테라코타', category: 'terracotta', rgb: [86, 91, 91], hex: '#565B5B' },
    { id: 'purple_terracotta', name: 'Purple Terracotta', nameKo: '보라색 테라코타', category: 'terracotta', rgb: [118, 70, 86], hex: '#764656' },
    { id: 'blue_terracotta', name: 'Blue Terracotta', nameKo: '파란색 테라코타', category: 'terracotta', rgb: [74, 59, 91], hex: '#4A3B5B' },
    { id: 'brown_terracotta', name: 'Brown Terracotta', nameKo: '갈색 테라코타', category: 'terracotta', rgb: [77, 51, 35], hex: '#4D3323' },
    { id: 'green_terracotta', name: 'Green Terracotta', nameKo: '초록색 테라코타', category: 'terracotta', rgb: [76, 83, 42], hex: '#4C532A' },
    { id: 'red_terracotta', name: 'Red Terracotta', nameKo: '빨간색 테라코타', category: 'terracotta', rgb: [143, 61, 46], hex: '#8F3D2E' },
    { id: 'black_terracotta', name: 'Black Terracotta', nameKo: '검은색 테라코타', category: 'terracotta', rgb: [37, 22, 16], hex: '#251610' },

    // ═══════════════════════════ GLASS ═══════════════════════════
    { id: 'glass', name: 'Glass', nameKo: '유리', category: 'glass', rgb: [175, 210, 225], hex: '#AFD2E1' },
    { id: 'white_stained_glass', name: 'White Stained Glass', nameKo: '하얀색 색유리', category: 'glass', rgb: [255, 255, 255], hex: '#FFFFFF' },
    { id: 'light_blue_stained_glass', name: 'Light Blue Stained Glass', nameKo: '하늘색 색유리', category: 'glass', rgb: [102, 153, 216], hex: '#6699D8' },
    { id: 'blue_stained_glass', name: 'Blue Stained Glass', nameKo: '파란색 색유리', category: 'glass', rgb: [51, 76, 178], hex: '#334CB2' },
    { id: 'cyan_stained_glass', name: 'Cyan Stained Glass', nameKo: '청록색 색유리', category: 'glass', rgb: [76, 127, 153], hex: '#4C7F99' },
    { id: 'gray_stained_glass', name: 'Gray Stained Glass', nameKo: '회색 색유리', category: 'glass', rgb: [76, 76, 76], hex: '#4C4C4C' },
    { id: 'black_stained_glass', name: 'Black Stained Glass', nameKo: '검은색 색유리', category: 'glass', rgb: [25, 25, 25], hex: '#191919' },
    { id: 'glass_pane', name: 'Glass Pane', nameKo: '유리판', category: 'glass', rgb: [175, 210, 225], hex: '#AFD2E1' },

    // ═══════════════════════════ BUILDING ═══════════════════════════
    { id: 'bricks', name: 'Bricks', nameKo: '벽돌', category: 'building', rgb: [150, 97, 83], hex: '#966153' },
    { id: 'sandstone', name: 'Sandstone', nameKo: '사암', category: 'building', rgb: [216, 203, 155], hex: '#D8CB9B' },
    { id: 'smooth_sandstone', name: 'Smooth Sandstone', nameKo: '매끈한 사암', category: 'building', rgb: [223, 214, 170], hex: '#DFD6AA' },
    { id: 'red_sandstone', name: 'Red Sandstone', nameKo: '붉은 사암', category: 'building', rgb: [186, 99, 29], hex: '#BA631D' },
    { id: 'quartz_block', name: 'Quartz Block', nameKo: '석영 블록', category: 'building', rgb: [236, 230, 223], hex: '#ECE6DF' },
    { id: 'smooth_quartz', name: 'Smooth Quartz', nameKo: '매끈한 석영', category: 'building', rgb: [236, 233, 226], hex: '#ECE9E2' },
    { id: 'quartz_bricks', name: 'Quartz Bricks', nameKo: '석영 벽돌', category: 'building', rgb: [234, 229, 222], hex: '#EAE5DE' },
    { id: 'prismarine', name: 'Prismarine', nameKo: '프리즈머린', category: 'building', rgb: [99, 156, 151], hex: '#639C97' },
    { id: 'dark_prismarine', name: 'Dark Prismarine', nameKo: '짙은 프리즈머린', category: 'building', rgb: [51, 91, 75], hex: '#335B4B' },
    { id: 'prismarine_bricks', name: 'Prismarine Bricks', nameKo: '프리즈머린 벽돌', category: 'building', rgb: [99, 171, 158], hex: '#63AB9E' },
    { id: 'mud_bricks', name: 'Mud Bricks', nameKo: '진흙 벽돌', category: 'building', rgb: [137, 104, 79], hex: '#89684F' },
    { id: 'packed_mud', name: 'Packed Mud', nameKo: '단단한 진흙', category: 'building', rgb: [142, 106, 79], hex: '#8E6A4F' },
    { id: 'calcite', name: 'Calcite', nameKo: '방해석', category: 'building', rgb: [223, 224, 220], hex: '#DFE0DC' },
    { id: 'end_stone_bricks', name: 'End Stone Bricks', nameKo: '엔드 석재 벽돌', category: 'building', rgb: [218, 224, 162], hex: '#DAE0A2' },
    { id: 'purpur_block', name: 'Purpur Block', nameKo: '퍼퍼 블록', category: 'building', rgb: [169, 125, 169], hex: '#A97DA9' },

    // ═══════════════════════════ METAL / ORE ═══════════════════════════
    { id: 'iron_block', name: 'Iron Block', nameKo: '철 블록', category: 'metal', rgb: [220, 220, 220], hex: '#DCDCDC' },
    { id: 'gold_block', name: 'Gold Block', nameKo: '금 블록', category: 'metal', rgb: [246, 208, 61], hex: '#F6D03D' },
    { id: 'diamond_block', name: 'Diamond Block', nameKo: '다이아몬드 블록', category: 'metal', rgb: [98, 237, 228], hex: '#62EDE4' },
    { id: 'emerald_block', name: 'Emerald Block', nameKo: '에메랄드 블록', category: 'metal', rgb: [42, 176, 65], hex: '#2AB041' },
    { id: 'lapis_block', name: 'Lapis Lazuli Block', nameKo: '청금석 블록', category: 'metal', rgb: [30, 67, 140], hex: '#1E438C' },
    { id: 'copper_block', name: 'Copper Block', nameKo: '구리 블록', category: 'metal', rgb: [192, 107, 79], hex: '#C06B4F' },
    { id: 'netherite_block', name: 'Netherite Block', nameKo: '네더라이트 블록', category: 'metal', rgb: [66, 61, 63], hex: '#423D3F' },

    // ═══════════════════════════ NETHER ═══════════════════════════
    { id: 'nether_bricks', name: 'Nether Bricks', nameKo: '네더 벽돌', category: 'nether', rgb: [44, 21, 26], hex: '#2C151A' },
    { id: 'red_nether_bricks', name: 'Red Nether Bricks', nameKo: '붉은 네더 벽돌', category: 'nether', rgb: [69, 7, 9], hex: '#450709' },
    { id: 'basalt', name: 'Basalt', nameKo: '현무암', category: 'nether', rgb: [72, 72, 78], hex: '#48484E' },
    { id: 'polished_basalt', name: 'Polished Basalt', nameKo: '윤나는 현무암', category: 'nether', rgb: [96, 96, 98], hex: '#606062' },
    { id: 'blackstone', name: 'Blackstone', nameKo: '흑암', category: 'nether', rgb: [42, 36, 41], hex: '#2A2429' },
    { id: 'polished_blackstone_bricks', name: 'Polished Blackstone Bricks', nameKo: '윤나는 흑암 벽돌', category: 'nether', rgb: [48, 42, 49], hex: '#302A31' },
    { id: 'obsidian', name: 'Obsidian', nameKo: '흑요석', category: 'nether', rgb: [15, 10, 24], hex: '#0F0A18' },

    // ═══════════════════════════ NATURE ═══════════════════════════
    { id: 'dirt', name: 'Dirt', nameKo: '흙', category: 'nature', rgb: [134, 96, 67], hex: '#866043' },
    { id: 'grass_block', name: 'Grass Block', nameKo: '잔디 블록', category: 'nature', rgb: [95, 159, 53], hex: '#5F9F35' },
    { id: 'sand', name: 'Sand', nameKo: '모래', category: 'nature', rgb: [219, 207, 163], hex: '#DBCFA3' },
    { id: 'gravel', name: 'Gravel', nameKo: '자갈', category: 'nature', rgb: [131, 127, 126], hex: '#837F7E' },
    { id: 'clay', name: 'Clay', nameKo: '점토', category: 'nature', rgb: [160, 166, 179], hex: '#A0A6B3' },
    { id: 'moss_block', name: 'Moss Block', nameKo: '이끼 블록', category: 'nature', rgb: [89, 109, 45], hex: '#596D2D' },
    { id: 'snow_block', name: 'Snow Block', nameKo: '눈 블록', category: 'nature', rgb: [249, 254, 254], hex: '#F9FEFE' },
    { id: 'ice', name: 'Ice', nameKo: '얼음', category: 'nature', rgb: [145, 183, 253], hex: '#91B7FD' },

    // ═══════════════════════════ WOOL (key colors) ═══════════════════════════
    { id: 'white_wool', name: 'White Wool', nameKo: '하얀색 양털', category: 'wool', rgb: [233, 236, 236], hex: '#E9ECEC' },
    { id: 'orange_wool', name: 'Orange Wool', nameKo: '주황색 양털', category: 'wool', rgb: [240, 118, 19], hex: '#F07613' },
    { id: 'magenta_wool', name: 'Magenta Wool', nameKo: '자홍색 양털', category: 'wool', rgb: [189, 68, 179], hex: '#BD44B3' },
    { id: 'light_blue_wool', name: 'Light Blue Wool', nameKo: '하늘색 양털', category: 'wool', rgb: [58, 175, 217], hex: '#3AAFD9' },
    { id: 'yellow_wool', name: 'Yellow Wool', nameKo: '노란색 양털', category: 'wool', rgb: [248, 198, 39], hex: '#F8C627' },
    { id: 'lime_wool', name: 'Lime Wool', nameKo: '연두색 양털', category: 'wool', rgb: [112, 185, 25], hex: '#70B919' },
    { id: 'pink_wool', name: 'Pink Wool', nameKo: '분홍색 양털', category: 'wool', rgb: [237, 141, 172], hex: '#ED8DAC' },
    { id: 'gray_wool', name: 'Gray Wool', nameKo: '회색 양털', category: 'wool', rgb: [63, 68, 71], hex: '#3F4447' },
    { id: 'light_gray_wool', name: 'Light Gray Wool', nameKo: '밝은 회색 양털', category: 'wool', rgb: [142, 142, 134], hex: '#8E8E86' },
    { id: 'cyan_wool', name: 'Cyan Wool', nameKo: '청록색 양털', category: 'wool', rgb: [21, 137, 145], hex: '#158991' },
    { id: 'purple_wool', name: 'Purple Wool', nameKo: '보라색 양털', category: 'wool', rgb: [121, 42, 172], hex: '#792AAC' },
    { id: 'blue_wool', name: 'Blue Wool', nameKo: '파란색 양털', category: 'wool', rgb: [53, 57, 157], hex: '#35399D' },
    { id: 'brown_wool', name: 'Brown Wool', nameKo: '갈색 양털', category: 'wool', rgb: [114, 71, 40], hex: '#724728' },
    { id: 'green_wool', name: 'Green Wool', nameKo: '초록색 양털', category: 'wool', rgb: [84, 109, 27], hex: '#546D1B' },
    { id: 'red_wool', name: 'Red Wool', nameKo: '빨간색 양털', category: 'wool', rgb: [160, 39, 34], hex: '#A02722' },
    { id: 'black_wool', name: 'Black Wool', nameKo: '검은색 양털', category: 'wool', rgb: [20, 21, 25], hex: '#141519' },

    // ═══════════════════════════ SPECIAL ═══════════════════════════
    { id: 'glowstone', name: 'Glowstone', nameKo: '발광석', category: 'special', rgb: [171, 131, 84], hex: '#AB8354' },
    { id: 'sea_lantern', name: 'Sea Lantern', nameKo: '바다 랜턴', category: 'special', rgb: [172, 199, 190], hex: '#ACC7BE' },
    { id: 'shroomlight', name: 'Shroomlight', nameKo: '버섯불', category: 'special', rgb: [240, 146, 70], hex: '#F09246' },
    { id: 'bone_block', name: 'Bone Block', nameKo: '뼈 블록', category: 'special', rgb: [229, 225, 207], hex: '#E5E1CF' },
    { id: 'hay_block', name: 'Hay Block', nameKo: '건초 블록', category: 'special', rgb: [166, 139, 36], hex: '#A68B24' },
    { id: 'honeycomb_block', name: 'Honeycomb Block', nameKo: '벌집 블록', category: 'special', rgb: [229, 148, 29], hex: '#E5941D' },
];

// Special air block (not in the main list)
export const AIR_BLOCK = { id: 'air', name: 'Air', nameKo: '공기', category: 'air', rgb: [135, 206, 235], hex: '#87CEEB' };

// Category labels
export const CATEGORIES = {
    stone: { name: 'Stone', nameKo: '석재', icon: '🪨' },
    wood: { name: 'Wood', nameKo: '나무', icon: '🪵' },
    concrete: { name: 'Concrete', nameKo: '콘크리트', icon: '🧱' },
    terracotta: { name: 'Terracotta', nameKo: '테라코타', icon: '🏺' },
    glass: { name: 'Glass', nameKo: '유리', icon: '🪟' },
    building: { name: 'Building', nameKo: '건축', icon: '🏛️' },
    metal: { name: 'Metal', nameKo: '금속', icon: '⚙️' },
    nether: { name: 'Nether', nameKo: '네더', icon: '🔥' },
    nature: { name: 'Nature', nameKo: '자연', icon: '🌿' },
    wool: { name: 'Wool', nameKo: '양털', icon: '🐑' },
    special: { name: 'Special', nameKo: '특수', icon: '✨' },
};

export default BLOCKS;
