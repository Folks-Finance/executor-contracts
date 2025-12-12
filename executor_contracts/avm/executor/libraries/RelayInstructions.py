from algopy import subroutine
from algopy.arc4 import DynamicBytes, UInt8, UInt128

from ...types import Bytes32

RECV_INST_TYPE_GAS = 1
RECV_INST_TYPE_DROP_OFF = 2

@subroutine
def encode_gas(gas_limit: UInt128, msg_val: UInt128) -> DynamicBytes:
    """Encodes the gas parameters for the executor.

    This instruction may be specified more than once. If so, the executor should sum the values.

    Args:
        gas_limit: The gas limit passed to the executor.
        msg_val:  The additional destination native currency passed to the executor. This may be zero.

    Returns:
        The encoded instruction bytes.
    """
    return DynamicBytes(UInt8(RECV_INST_TYPE_GAS).bytes + gas_limit.bytes + msg_val.bytes)

@subroutine
def encode_gas_drop_off(drop_off: UInt128, recipient: Bytes32) -> DynamicBytes:
    """Encodes the gas drop off parameters for the executor.

    This instruction may be specified more than once. If so, the executor should sum the values.

    Args:
        drop_off: The amount of gas to be dropped off.
        recipient: The recipient of the drop off.

    Returns:
        The encoded instruction bytes.
    """
    return DynamicBytes(UInt8(RECV_INST_TYPE_DROP_OFF).bytes + drop_off.bytes + recipient.bytes)
