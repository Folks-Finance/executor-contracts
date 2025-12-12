from algopy import Bytes, Global, Txn, gtxn
from algopy.arc4 import Address, DynamicBytes, Struct, UInt16, abimethod, emit

from ....types import ARC4UInt16, ARC4UInt64, Bytes32
from ..interfaces.IExecutor import IExecutor


# Events
class RequestForExecution(Struct):
    amt_paid: ARC4UInt64
    dst_chain: ARC4UInt16
    dst_addr: Bytes32
    refund_addr: Address
    signed_quote_bytes: DynamicBytes
    request_bytes: DynamicBytes
    relay_instructions: DynamicBytes


class MockExecutor(IExecutor):
    @abimethod
    def request_execution(
        self,
        fee_payment: gtxn.PaymentTransaction,
        dst_chain: UInt16,
        dst_addr: Bytes32,
        refund_addr: Address,
        signed_quote_bytes: Bytes,
        request_bytes: Bytes,
        relay_instructions: Bytes,
    ) -> None:
        assert fee_payment.sender == Txn.sender, "Fee txn must be from same sender"
        assert fee_payment.receiver == Global.current_application_address, "Unknown fee payment receiver"

        emit(RequestForExecution(
            ARC4UInt64(fee_payment.amount),
            dst_chain,
            dst_addr,
            refund_addr,
            DynamicBytes(signed_quote_bytes),
            DynamicBytes(request_bytes),
            DynamicBytes(relay_instructions),
        ))
