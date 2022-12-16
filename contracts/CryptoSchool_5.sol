// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract CryptoSchool_5 {
    address public owner;
    mapping(address => uint256) public payments;
    bytes32 internal constant _VAULT_FRACTION_TO_INVEST_NUMERATOR_SLOT = 0x39122c9adfb653455d0c05043bd52fcfbc2be864e832efd3abc72ce5a3d7ed5a;

    constructor() {
        owner = msg.sender;
    }

    function deposit() public payable {
        payments[msg.sender] = msg.value;
    }

    function MoneyBack() public {
        address payable _to = payable(owner);
        address _thisContract = address(this);
        _to.transfer(_thisContract.balance);
    }

    receive() external payable {}
}
