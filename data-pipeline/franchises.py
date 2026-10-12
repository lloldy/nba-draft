"""Maps Basketball-Reference team abbreviations (historic and current) to our 30 franchises."""

TEAM_TO_FRANCHISE = {
    # Atlanta
    "ATL": "ATL", "STL": "ATL", "MLH": "ATL",
    # Boston
    "BOS": "BOS",
    # Brooklyn
    "BRK": "BKN", "NJN": "BKN", "NYN": "BKN",
    # Charlotte (NBA counts Bobcats/Hornets 2.0 history as one franchise)
    "CHO": "CHA", "CHA": "CHA", "CHH": "CHA",
    # Chicago
    "CHI": "CHI",
    # Cleveland
    "CLE": "CLE",
    # Dallas
    "DAL": "DAL",
    # Denver
    "DEN": "DEN",
    # Detroit
    "DET": "DET", "FTW": "DET",
    # Golden State
    "GSW": "GSW", "SFW": "GSW", "PHW": "GSW",
    # Houston
    "HOU": "HOU", "SDR": "HOU",
    # Indiana
    "IND": "IND",
    # LA Clippers
    "LAC": "LAC", "SDC": "LAC", "BUF": "LAC",
    # LA Lakers
    "LAL": "LAL", "MNL": "LAL",
    # Memphis
    "MEM": "MEM", "VAN": "MEM",
    # Miami
    "MIA": "MIA",
    # Milwaukee
    "MIL": "MIL",
    # Minnesota
    "MIN": "MIN",
    # New Orleans (Hornets 1.0 stays with Charlotte; Pelicans start 2002)
    "NOP": "NOP", "NOH": "NOP", "NOK": "NOP",
    # New York
    "NYK": "NYK",
    # Oklahoma City
    "OKC": "OKC", "SEA": "OKC",
    # Orlando
    "ORL": "ORL",
    # Philadelphia
    "PHI": "PHI", "SYR": "PHI",
    # Phoenix
    "PHO": "PHX",
    # Portland
    "POR": "POR",
    # Sacramento
    "SAC": "SAC", "KCK": "SAC", "KCO": "SAC", "CIN": "SAC", "ROC": "SAC",
    # San Antonio
    "SAS": "SAS",
    # Toronto
    "TOR": "TOR",
    # Utah
    "UTA": "UTA", "NOJ": "UTA",
    # Washington
    "WAS": "WAS", "WSB": "WAS", "BAL": "WAS", "CHZ": "WAS", "CHP": "WAS",
}


# Historical team names by Basketball-Reference abbreviation. Shown on boards and cards, so Payton/Kemp play for
# the "Seattle SuperSonics" and not for Oklahoma City. colors: optional override (primary, secondary).
TEAM_NAMES = {
    "ATL": "Atlanta Hawks", "STL": "St. Louis Hawks", "MLH": "Milwaukee Hawks",
    "BOS": "Boston Celtics",
    "BRK": "Brooklyn Nets", "NJN": "New Jersey Nets", "NYN": "New York Nets",
    "CHO": "Charlotte Hornets", "CHA": "Charlotte Bobcats", "CHH": "Charlotte Hornets",
    "CHI": "Chicago Bulls", "CLE": "Cleveland Cavaliers", "DAL": "Dallas Mavericks", "DEN": "Denver Nuggets",
    "DET": "Detroit Pistons", "FTW": "Fort Wayne Pistons",
    "GSW": "Golden State Warriors", "SFW": "San Francisco Warriors", "PHW": "Philadelphia Warriors",
    "HOU": "Houston Rockets", "SDR": "San Diego Rockets",
    "IND": "Indiana Pacers",
    "LAC": "Los Angeles Clippers", "SDC": "San Diego Clippers", "BUF": "Buffalo Braves",
    "LAL": "Los Angeles Lakers", "MNL": "Minneapolis Lakers",
    "MEM": "Memphis Grizzlies", "VAN": "Vancouver Grizzlies",
    "MIA": "Miami Heat", "MIL": "Milwaukee Bucks", "MIN": "Minnesota Timberwolves",
    "NOP": "New Orleans Pelicans", "NOH": "New Orleans Hornets", "NOK": "New Orleans/Oklahoma City Hornets",
    "NYK": "New York Knicks",
    "OKC": "Oklahoma City Thunder", "SEA": "Seattle SuperSonics",
    "ORL": "Orlando Magic",
    "PHI": "Philadelphia 76ers", "SYR": "Syracuse Nationals",
    "PHO": "Phoenix Suns", "POR": "Portland Trail Blazers",
    "SAC": "Sacramento Kings", "KCK": "Kansas City Kings", "KCO": "Kansas City-Omaha Kings",
    "CIN": "Cincinnati Royals", "ROC": "Rochester Royals",
    "SAS": "San Antonio Spurs", "TOR": "Toronto Raptors",
    "UTA": "Utah Jazz", "NOJ": "New Orleans Jazz",
    "WAS": "Washington Wizards", "WSB": "Washington Bullets", "BAL": "Baltimore Bullets",
    "CHZ": "Chicago Zephyrs", "CHP": "Chicago Packers",
}
TEAM_COLORS = {
    "SEA": ("#00653A", "#FFC200"),  # SuperSonics green/gold
    "WSB": ("#E31837", "#002B5C"),  # Bullets
    "BAL": ("#E31837", "#002B5C"),
    "NJN": ("#002A60", "#CD1041"),
    "CHH": ("#00778B", "#280071"),  # original Hornets teal/purple
    "VAN": ("#00B2A9", "#E43C40"),  # Vancouver Grizzlies
    "KCK": ("#6F263D", "#FFB612"),
    "SDC": ("#C8102E", "#1D428A"),
    "BUF": ("#7AC143", "#FF6F00"),
    "NOJ": ("#2C1B6E", "#F9A01B"),
    "MNL": ("#552583", "#FDB927"),
}
# Players who may play every position without penalty (the rating is the same in all five slots).
ALL_POSITION_PLAYERS = {"LeBron James"}
