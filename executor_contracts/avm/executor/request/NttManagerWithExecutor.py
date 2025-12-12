from algopy import Account, Bytes, Global, GlobalState, OnCompleteAction, String, Txn, UInt64, gtxn, itxn, subroutine, op
from algopy.arc4 import UInt16, abi_call, abimethod, arc4_signature

from folks_contracts.library import BytesUtils
from ntt_contracts.ntt_manager.interfaces.INttManager import INttManager
from ... import constants as const
from ...types import Bytes32
from ..libraries import ExecutorMessages, MathsUtils
from .interfaces.IExecutor import IExecutor
from .interfaces.INttManagerWithExecutor import ExecutorArgs, FeeArgs, INttManagerWithExecutor


# Constants
EXECUTOR_VERSION = "NttManagerWithExecutor-0.0.1"


class NttManagerWithExecutor(INttManagerWithExecutor):
    def __init__(self) -> None:
        self.executor_version = String(EXECUTOR_VERSION)
        self.our_chain = GlobalState(UInt16)
        self.executor = GlobalState(UInt64)

    @abimethod(create="require")
    def create(self, our_chain: UInt16, executor: UInt64) -> None:
        self.our_chain.value = our_chain
        self.executor.value = executor

    @abimethod
    def transfer(
        self,
        ntt_send_token: gtxn.AssetTransferTransaction,
        ntt_transfer: gtxn.ApplicationCallTransaction,
        pay_executor: gtxn.PaymentTransaction,
        pay_referrer: gtxn.AssetTransferTransaction,
        amount: UInt64,
        executor_args: ExecutorArgs,
        fee_args: FeeArgs,
    ) -> None:
        # ntt_send_token implicitly checked by ntt_transfer call

        # check the ntt_transfer call
        assert ntt_transfer.on_completion == OnCompleteAction.NoOp, "Incorrect app on completion"
        assert (ntt_transfer.app_args(0) == arc4_signature(INttManager.transfer) or
                ntt_transfer.app_args(0) == arc4_signature(INttManager.transfer_full)), "Incorrect method"
        assert op.extract(ntt_transfer.last_log, 0, 4) == Bytes.from_hex(const.RETURN_PREFIX)
        message_id = Bytes32.from_bytes(op.substring(ntt_transfer.last_log, 4, ntt_transfer.last_log.length))
        recipient_chain = UInt16(op.btoi(ntt_transfer.app_args(2)))

        # check executor pay to then forward, amount is not checked
        assert pay_executor.sender == Txn.sender, "Pay executor txn must be from same sender"
        assert pay_executor.receiver == Global.current_application_address, "Unknown pay executor receiver"

        # check referrer pay
        assert pay_referrer.xfer_asset == ntt_send_token.xfer_asset, "Unknown pay referrer asset"
        assert pay_referrer.sender == ntt_send_token.sender, "Pay referrer txn must be from same sender"
        assert pay_referrer.asset_receiver == Account(fee_args.payee.bytes), "Unknown pay referrer receiver"

        # check the amounts
        referrer_fee_amount = MathsUtils.calculate_fee(amount, fee_args.dbps)
        assert pay_referrer.asset_amount == referrer_fee_amount, "Incorrect pay referrer amount"
        assert op.btoi(ntt_transfer.app_args(1)) == amount - referrer_fee_amount, "Incorrect ntt transfer amount"

        # prepare request_execution call
        executor_address, exists = op.AppParamsGet.app_address(self.executor.value)
        assert exists, "Executor address unknown"
        src_manager = BytesUtils.convert_uint64_to_bytes32(ntt_transfer.app_id.id)
        ntt_manager_peer, txn = abi_call(
            INttManager.get_ntt_manager_peer,
            recipient_chain,
            app_id=ntt_transfer.app_id,
            fee=0
        )

        abi_call(
            IExecutor.request_execution,
            itxn.Payment(receiver=executor_address, amount=pay_executor.amount, fee=0),
            recipient_chain,
            ntt_manager_peer.peer_contract,
            executor_args.refund_address,
            executor_args.signed_quote_bytes,
            ExecutorMessages.make_ntt_v1_request(self.our_chain.value, src_manager, message_id),
            executor_args.relay_instructions,
            app_id=self.executor.value,
            fee=0
        )
