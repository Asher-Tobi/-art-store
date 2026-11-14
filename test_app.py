import os

from app import calculate_btc_amount, get_btc_wallet_address


def test_wallet_is_configured():
    wallet = get_btc_wallet_address()
    assert isinstance(wallet, str)
    assert len(wallet) > 20


def test_btc_conversion_for_usd_total():
    amount = calculate_btc_amount(1000)
    assert amount > 0
    assert amount < 1
