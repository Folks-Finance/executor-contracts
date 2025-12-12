from algopy import UInt64, subroutine
from algopy.arc4 import UInt16


@subroutine
def calculate_fee(amount: UInt64, dbps: UInt16) -> UInt64:
    """Calculates the percentage fee amount.

    Args:
        amount: The amount to charge the fee on.
        dbps: The fee in tenths of basis points.

    Returns:
        The fee amount
    """
    q = amount // 100000
    r = amount % 100000
    return q * dbps.as_uint64() + (r * dbps.as_uint64()) // 100000
