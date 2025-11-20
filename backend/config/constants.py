"""
Constants loaded from global configuration.
"""
from backend.config.settings import GLOBAL_CONFIG, get_config_value

# Doctrine Flags
STAMPED = get_config_value("doctrine.STAMPED", True)
SPVPET = get_config_value("doctrine.SPVPET", True)
STACKED = get_config_value("doctrine.STACKED", True)
BARTON_DOCTRINE = get_config_value("doctrine.BARTON_DOCTRINE", True)

# Scoring Weights
SCORE_WEIGHTS = get_config_value("scoring.weights", {
    "saturation": 0.25,
    "parcel": 0.25,
    "county": 0.20,
    "financial": 0.30
})

# Saturation Constants
SQFT_PER_PERSON = get_config_value("saturation.sqft_per_person", 6)
SATURATION_UNDERSUPPLIED_THRESHOLD = get_config_value("saturation.undersupplied_threshold", 0.7)
SATURATION_OVERSUPPLIED_THRESHOLD = get_config_value("saturation.oversupplied_threshold", 1.1)
SATURATION_ELIMINATION_THRESHOLD = get_config_value("saturation.elimination_threshold", 1.1)

# Financial Constants
FINANCIAL_UNITS = get_config_value("financial.units", 116)
FINANCIAL_VACANCY_RATE = get_config_value("financial.vacancy_rate", 0.20)
# Calculate derived constant (overrides config value if present)
FINANCIAL_RENTED_UNITS = int(FINANCIAL_UNITS * (1 - FINANCIAL_VACANCY_RATE))
FINANCIAL_BUILD_COST = get_config_value("financial.build_cost", 400000)
FINANCIAL_LOAN_PAYMENT = get_config_value("financial.loan_payment", 2577)
FINANCIAL_RENT_LOW = get_config_value("financial.rent_low", 80)
FINANCIAL_RENT_HIGH = get_config_value("financial.rent_high", 120)
FINANCIAL_MIN_DSCR = get_config_value("financial.min_dscr", 1.0)

# Parcel Scoring Thresholds
PARCEL_SHAPE_THRESHOLD = get_config_value("parcel.shape_threshold", 50)
PARCEL_SLOPE_THRESHOLD = get_config_value("parcel.slope_threshold", 50)
PARCEL_ACCESS_THRESHOLD = get_config_value("parcel.access_threshold", 50)
FLOODPLAIN_ELIMINATION = get_config_value("parcel.floodplain_elimination", True)

# Elimination Thresholds
MIN_POPULATION = get_config_value("elimination.min_population", 5000)
MIN_HOUSEHOLDS = get_config_value("elimination.min_households", 2000)
MIN_TRAFFIC_COUNT = get_config_value("elimination.min_traffic_count", 5000)
MAX_COUNTY_DIFFICULTY = get_config_value("elimination.max_county_difficulty", 50)
MIN_FINAL_SCORE = get_config_value("elimination.min_final_score", 60)

# States Supported
SUPPORTED_STATES = get_config_value("states.supported", ["WV", "PA", "MD", "VA"])

# County Difficulty Defaults
DEFAULT_COUNTY_DIFFICULTY = get_config_value("county.default_difficulty", 50)
FAST_PERMITTING_SCORE = get_config_value("county.fast_permitting_score", 80)
SLOW_PERMITTING_SCORE = get_config_value("county.slow_permitting_score", 20)

# Status Values
STATUS_PENDING = "pending"
STATUS_SCREENING = "screening"
STATUS_SATURATION = "saturation"
STATUS_SCORING = "scoring"
STATUS_COMPLETED = "completed"
STATUS_ELIMINATED = "eliminated"

# API Configuration
API_PREFIX = get_config_value("api.prefix", "/api")
API_VERSION = get_config_value("api.version", "1.0.0")
API_TITLE = get_config_value("api.title", "Storage Site Scouting API")

# Database Configuration
DB_POOL_MIN_SIZE = get_config_value("database.pool_min_size", 2)
DB_POOL_MAX_SIZE = get_config_value("database.pool_max_size", 10)
DB_COMMAND_TIMEOUT = get_config_value("database.command_timeout", 60)
DB_TABLE_PREFIX = get_config_value("database.table_prefix", "")

# Logging Configuration
LOG_LEVEL = get_config_value("logging.level", "INFO")
LOG_FORMAT = get_config_value("logging.format", "%(asctime)s - %(name)s - %(levelname)s - %(message)s")
LOG_DATEFMT = get_config_value("logging.datefmt", "%Y-%m-%d %H:%M:%S")

