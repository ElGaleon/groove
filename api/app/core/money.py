"""Minor-unit helpers: amounts are integers (cents) with an ISO currency."""

# Currencies with no decimals; everything else uses two.
_ZERO = {"JPY", "KRW", "CLP", "ISK", "VND"}


def fraction_digits(currency: str) -> int:
    return 0 if currency.upper() in _ZERO else 2


# Currencies a member can pick as the default for new prices.
SUPPORTED_CURRENCIES = ("EUR", "USD", "GBP", "JPY", "CHF")
