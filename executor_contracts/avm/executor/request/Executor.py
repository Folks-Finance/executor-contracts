from algopy import Account, Bytes, Global, GlobalState, String, Txn, UInt64, gtxn, itxn, op
from algopy.arc4 import Address, DynamicBytes, UInt16, abimethod, emit

from ...types import ARC4UInt64, Bytes20, Bytes32
from .interfaces.IExecutor import IExecutor, RequestForExecution

# Constants
EXECUTOR_VERSION = "Executor-0.0.1"


class Executor(IExecutor):
    def __init__(self) -> None:
        self.executor_version = String(EXECUTOR_VERSION)
        self.our_chain = GlobalState(UInt16)

    @abimethod(create="require")
    def create(self, our_chain: UInt16) -> None:
        self.our_chain.value = our_chain

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
        quote_src_chain = op.extract_uint16(signed_quote_bytes, 56)
        quote_dst_chain = op.extract_uint16(signed_quote_bytes, 58)
        expiry_time = op.extract_uint64(signed_quote_bytes, 60)

        assert quote_src_chain == self.our_chain.value, "Quote source chain mismatch"
        assert quote_dst_chain == dst_chain.as_uint64(), "Quote destination chain mismatch"
        assert Global.latest_timestamp < expiry_time, "Quote expired"

        quoter_address = Bytes20.from_bytes(op.extract(signed_quote_bytes, 4, 20))
        universal_payee_address = op.extract(signed_quote_bytes, 24, 32)

        # forward payment to payee, amount is not checked
        assert fee_payment.sender == Txn.sender, "Fee txn must be from same sender"
        assert fee_payment.receiver == Global.current_application_address, "Unknown fee payment receiver"
        itxn.Payment(receiver=Account(universal_payee_address), amount=fee_payment.amount, fee=0).submit()

        emit(RequestForExecution(
            quoter_address,
            ARC4UInt64(fee_payment.amount),
            dst_chain,
            dst_addr,
            refund_addr,
            DynamicBytes(signed_quote_bytes),
            DynamicBytes(request_bytes),
            DynamicBytes(relay_instructions),
        ))
